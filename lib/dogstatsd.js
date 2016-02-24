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

  increment(stat, sampleRate, tags) {
    this.send(stat, `${1}|c`, sampleRate, tags)
  }

  incrementBy(stat, value, sampleRate, tags) {
    this.send(stat, `${value}|c`, sampleRate, tags)
  }

  decrement(stat, sampleRate, tags) {
    this.send(stat, `${-1}|c`, sampleRate, tags)
  }

  decrementBy(stat, value, sampleRate, tags) {
    this.send(stat, `${-value}|c`, sampleRate, tags)
  }

  gauge(stat, value, sampleRate, tags) {
    this.send(stat, `${value}|g`, sampleRate, tags)
  }

  histogram(stat, value, sampleRate, tags) {
    this.send(stat, `${value}|h`, sampleRate, tags)
  }

  set(stat, value, sampleRate, tags) {
    this.send(stat, `${value}|s`, sampleRate, tags)
  }

  timing(stat, time, sampleRate, tags) {
    this.send(stat, `${time}|ms`, sampleRate, tags)
  }

  createTimer(stat, sampleRate, tags) {
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
        this.timing(stat, duration, sampleRate, tags)
      },
    }
  }

  send(stat, value, sampleRate, tags) {
    if ( !tags && Array.isArray(sampleRate) ) {
      tags = sampleRate
      sampleRate = null
    }

    if ( !sampleRate ) sampleRate = 1

    const allTags = Array.isArray(tags)
      ? this.globalTags.concat(tags)
      : this.globalTags

    const tagsStr = allTags.length > 0
      ? `|#${allTags.join(',')}`
      : ''

    const sampleRateStr = sampleRate < 1 ? `|@${sampleRate}` : ''

    const metric = `${stat}:${value}${sampleRateStr}${tagsStr}`
    this.send_data(new Buffer(metric))
  }

  send_data (buf) {
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
