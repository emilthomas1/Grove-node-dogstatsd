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
    const stats = { [stat]: `${time}|ms` }
    this.send(stats, sample_rate, tags)
  }

  increment(stats, sample_rate, tags) {
    this.update_stats(stats, 1, sample_rate, tags)
  }

  incrementBy(stats, value, sample_rate, tags) {
    if ( value === 0 ) return;
    this.update_stats(stats, value, sample_rate, tags)
  }

  decrement(stats, sample_rate, tags) {
    this.update_stats(stats, -1, sample_rate, tags)
  }

  decrementBy(stats, value, sample_rate, tags) {
    if ( value === 0 ) return;
    this.update_stats(stats, -value, sample_rate, tags)
  }

  gauge(stat, value, sample_rate, tags) {
    const stats = { [stat]: `${value}|g` }
    this.send(stats, sample_rate, tags)
  }

  histogram(stat, value, sample_rate, tags) {
    const stats = { [stat]: `${value}|h` }
    this.send(stats, sample_rate, tags)
  }

  set(stat, value, sample_rate, tags) {
    const stats = { [stat]: `${value}|s` }
    this.send(stats, sample_rate, tags)
  }

  update_stats(stats, delta, sampleRate, tags) {
    if ( !Array.isArray(stats) ) stats = [stats]
    if ( !delta ) delta = 1

    const data = stats.reduce((obj, stat) => {
      obj[stat] = `${delta}|c`
      return obj
    }, {})
    this.send(data, sampleRate, tags)
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
