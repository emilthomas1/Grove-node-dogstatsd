'use strict'

const dgram = require('dgram')

const EPHEMERAL_LIFETIME_MS = 1000

module.exports = class DogStatsD {
  constructor(host, port, socket, options) {
    this.host = host || 'localhost'
    this.port = port || 8125

    // optional shared socket
    this.socket = socket

    // when a shared socked isn't provided an ephemeral
    // socket is demand-allocated. The ephemeral socket is closed
    // after being idle for EPHEMERAL_LIFETIME_MS
    this.ephemeralSocket = null
    this.lastUsedTimer = null

    options = options || {}
    this.globalTags = options.globalTags || []
  }

  increment(stat, value, options) {
    if ( !value ) value = 1
    this.send(stat, 1, 'c', options)
  }

  decrement(stat, value, options) {
    if ( !value ) value = 1
    this.send(stat, -value, 'c', options)
  }

  gauge(stat, value, options) {
    this.send(stat, value, 'g', options)
  }

  histogram(stat, value, options) {
    this.send(stat, value, 'h', options)
  }

  set(stat, value, options) {
    this.send(stat, value, 's', options)
  }

  timing(stat, time, options) {
    this.send(stat, time, 'ms', options)
  }

  createTimer(stat, options) {
    const start = process.hrtime()
    let stopped = false

    return {
      stop: () => {
        if ( stopped ) {
          console.log('Tried to stop a DogStatsD timer more than once')
          return
        }
        stopped = true
        const diff = process.hrtime(start)
        const duration = diff[0] * 1e3 + diff[1] / 1e6
        this.timing(stat, duration, options)
      },
    }
  }

  send(stat, value, id, options) {
    if ( !options ) options = {}
    let sampleRate = options.sampleRate

    if ( !sampleRate ) sampleRate = 1
    // This is where sampling occurs
    if ( sampleRate !== 1 && Math.random() > sampleRate ) return;

    let metric = `${stat}:${value}|${id}`

    if ( sampleRate !== 1) metric += `|@${sampleRate}`

    const allTags = Array.isArray(options.tags)
      ? this.globalTags.concat(options.tags)
      : this.globalTags

    metric += allTags.length > 0 ? `|#${allTags.join(',')}` : ''

    this.sendData(new Buffer(metric))
  }

  sendEvent(title, text, options) {
    // Title and text are required, silently fail if they're not there
    if ( !title || !text ) return;

    let str = `_e{${title.length},${text.length}}:${title}|${text}`
    if ( !options ) options = {}
    if ( !options.dateHappened ) options.dateHappened = Date.now()
    if ( !options.priority ) options.priority = 'normal'
    if ( !options.type ) options.type = 'info'

    str += `|d:${options.dateHappened}|p:${options.priority}|t:${options.type}`
    if ( options.hostname ) str += `|h:${options.hostname}`
    if ( options.aggregationKey ) str += `|k:${options.aggregationKey}`
    if ( options.sourceTypeName ) str += `|s:${options.sourceTypeName}`
    if ( Array.isArray(options.tags) && options.tags.length > 0 ) {
      str += `|#${options.tags.join(',')}`
    }
    this.sendData(new Buffer(str))
  }

  sendData (buf) {
    let socket

    if ( !this.socket ) {
      if ( !this.ephemeralSocket ) {
        this.ephemeralSocket = dgram.createSocket('udp4')
        // Swallow the errors with a no-op
        this.ephemeralSocket.on('error', (err) => {})
      }
      socket = this.ephemeralSocket
    } else {
      socket = this.socket
    }

    this._update_last_used()

    socket.send(buf, 0, buf.length, this.port, this.host)
  }

  close() {
    if ( this.socket ) this.socket.close()
    if ( this.ephemeralSocket ) this.ephemeralSocket.close()
    if ( this.lastUsedTimer ) clearTimeout(this.lastUsedTimer)
    this.ephemeralSocket = null
    this.lastUsedTimer = null
    this.socket = null
  }

  // An internal function update the last time the socket was
  // used. This function is called when the socket is used, and
  // causes demand-allocated ephemeral sockets to be closed
  // after a period of inactivity
  _update_last_used () {
    if ( !this.ephemeralSocket ) return;

    if ( this.lastUsedTimer ) clearTimeout(this.lastUsedTimer)

    this.lastUsedTimer = setTimeout(() => {
      if ( this.ephemeralSocket ) this.ephemeralSocket.close()
      this.ephemeralSocket = null
    }, EPHEMERAL_LIFETIME_MS)
  }

}
