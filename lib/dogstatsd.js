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
    this.ephemeral_socket = null
    this.last_used_timer = null

    options = options || {}
    this.global_tags = options.global_tags
  }

  timing(stat, time, sample_rate, tags) {
    this.send({ [stat]: `${time}|ms` }, sample_rate, tags)
  }

  createTimer(stat, sample_rate, tags) {
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
        this.timing(stat, duration, sample_rate, tags)
      },
    }
  }

  increment(stat, sample_rate, tags) {
    this.send({ [stat]: `${1}|c` }, sample_rate, tags)
  }

  incrementBy(stat, value, sample_rate, tags) {
    this.send({ [stat]: `${value}|c` }, sample_rate, tags)
  }

  decrement(stat, sample_rate, tags) {
    this.send({ [stat]: `${-1}|c` }, sample_rate, tags)
  }

  decrementBy(stat, value, sample_rate, tags) {
    this.send({ [stat]: `${-value}|c` }, sample_rate, tags)
  }

  gauge(stat, value, sample_rate, tags) {
    this.send({ [stat]: `${value}|g` }, sample_rate, tags)
  }

  histogram(stat, value, sample_rate, tags) {
    this.send({ [stat]: `${value}|h` }, sample_rate, tags)
  }

  set(stat, value, sample_rate, tags) {
    this.send({ [stat]: `${value}|s` }, sample_rate, tags)
  }

  send(data, sample_rate, tags) {
    if ( !tags && Array.isArray(sample_rate) ) {
      tags = sample_rate
      sample_rate = null
    }

    if ( !sample_rate ) sample_rate = 1

    let sampled_data = {}
    if ( sample_rate < 1 ) {
      if ( Math.random() <= sample_rate ) {
        for ( let stat in data ) {
          sampled_data[stat] = `${data[stat]}|@${sample_rate}`
        }
      }
    } else sampled_data = data

    if ( this.global_tags || tags ) {
      let merged_tags = []

      if ( Array.isArray(this.global_tags) ) {
        merged_tags = merged_tags.concat(this.global_tags)
      }

      if ( Array.isArray(tags) ) merged_tags = merged_tags.concat(tags)

      if ( merged_tags.length > 0 ) {
        const merged_tags_str = merged_tags.join(',')
        for ( let stat in sampled_data) {
          sampled_data[stat] = `${sampled_data[stat]}|#${merged_tags_str}`
        }
      }
    }

    for ( let stat in sampled_data ) {
      const str = `${stat}:${sampled_data[stat]}`
      this.send_data(new Buffer(str))
    }
  }

  send_data (buf) {
    let socket

    if ( !this.socket ) {
      if ( !this.ephemeral_socket ) {
        this.ephemeral_socket = dgram.createSocket('udp4')
        // Swallow the errors with a no-op
        this.ephemeral_socket.on('error', (err) => {})
      }
      socket = this.ephemeral_socket
    } else {
      socket = this.socket
    }

    this._update_last_used()

    socket.send(buf, 0, buf.length, this.port, this.host)
  }

  close() {
    if ( this.socket ) this.socket.close()
    if ( this.ephemeral_socket ) this.ephemeral_socket.close()
    if ( this.last_used_timer ) clearTimeout(this.last_used_timer)
    this.ephemeral_socket = null
    this.last_used_timer = null
    this.socket = null
  }

  // An internal function update the last time the socket was
  // used. This function is called when the socket is used, and
  // causes demand-allocated ephemeral sockets to be closed
  // after a period of inactivity
  _update_last_used () {
    if ( !this.ephemeral_socket ) return;

    if ( this.last_used_timer ) clearTimeout(this.last_used_timer)

    this.last_used_timer = setTimeout(() => {
      if ( this.ephemeral_socket ) this.ephemeral_socket.close()
      delete this.ephemeral_socket
    }, EPHEMERAL_LIFETIME_MS)
  }

}
