'use strict'

const assert = require('assert')
const dgram = require('dgram')
const DogStatsD = require('../lib/dogstatsd')

// Calls the given function the given number of times.
function times(n, fn) {
  for (let i = n - 1; i >= 0; i--) {
    fn()
  }
}

describe('DogStatsD', () => {
  let fakeStatsDSocket
  let client

  beforeEach(done => {
    fakeStatsDSocket = dgram.createSocket('udp4')
    fakeStatsDSocket.bind(() => {
      client = new DogStatsD('localhost', fakeStatsDSocket.address().port)
      done()
    })
  })

  afterEach(() => {
    fakeStatsDSocket.close()
  })

  // Wraps up listening for the next message on our fake socket and
  // verifying that it's contents match those expected. Calls back
  // once this check has been performed.
  function serverShouldReceive(expected, done) {
    fakeStatsDSocket.once('message', (msg) => {
      try {
        assert.equal(msg.toString('utf8'), expected)
      } catch (e) {
        return done(e)
      }
      done()
    })
  }

  function serverShouldReceiveMultiple(expected, n, done) {
    let remaining = n
    function checker(msg) {
      remaining--
      try {
        assert.equal(msg.toString('utf8'), expected)
      } catch (e) {
        return done(e)
      }
      if (remaining === 0) {
        fakeStatsDSocket.removeListener('message', checker)
        done()
      }
    }
    fakeStatsDSocket.on('message', checker)
  }

  describe('timing', () => {
    it('should send the timing measurement in milliseconds', done => {
      serverShouldReceive('latency:200|ms', done)
      client.timing('latency', 200)
    })

    it('should include the tags if provided', done => {
      serverShouldReceive('latency:200|ms|#app:web,feature:on', done)
      client.timing('latency', 200, ['app:web', 'feature:on'])
    })

    it('should include the sample rate and sample if provided', done => {
      serverShouldReceiveMultiple('latency:200|ms|@0.9|#app:web,feature:on', 2, done)
      times(100, () => {
        client.timing('latency', 200, 0.9, ['app:web', 'feature:on'])
      })
    })
  })

  describe('increment', () => {
    it('should send the increment', done => {
      serverShouldReceive('requests:1|c', done)
      client.increment('requests')
    })

    it('should include the tags if provided', done => {
      serverShouldReceive('requests:1|c|#app:web,feature:on', done)
      client.increment('requests', ['app:web', 'feature:on'])
    })

    it('should include the sample rate and sample if provided', done => {
      serverShouldReceiveMultiple('requests:1|c|@0.9|#app:web,feature:on', 2, done)
      times(100, () => {
        client.increment('requests', 0.9, ['app:web', 'feature:on'])
      })
    })
  })

  describe('decrement', () => {
    it('should send the decrement', done => {
      serverShouldReceive('requests:-1|c', done)
      client.decrement('requests')
    })

    it('should include the tags if provided', done => {
      serverShouldReceive('requests:-1|c|#app:web,feature:on', done)
      client.decrement('requests', ['app:web', 'feature:on'])
    })

    it('should include the sample rate and sample if provided', done => {
      serverShouldReceiveMultiple('requests:-1|c|@0.9|#app:web,feature:on', 2, done)
      times(100, () => {
        client.decrement('requests', 0.9, ['app:web', 'feature:on'])
      })
    })
  })

  describe('gauge', () => {
    it('should send the gauge value', done => {
      serverShouldReceive('usable_memory:64|g', done)
      client.gauge('usable_memory', 64)
    })

    it('should include the tags if provided', done => {
      serverShouldReceive('usable_memory:64|g|#app:web,feature:on', done)
      client.gauge('usable_memory', 64, ['app:web', 'feature:on'])
    })

    it('should include the sample rate and sample if provided', done => {
      serverShouldReceiveMultiple('usable_memory:64|g|@0.9|#app:web,feature:on', 2, done)
      times(100, () => {
        client.gauge('usable_memory', 64, 0.9, ['app:web', 'feature:on'])
      })
    })
  })

  describe('histogram', () => {
    it('should send the histogram value', done => {
      serverShouldReceive('query_time:777|h', done)
      client.histogram('query_time', 777)
    })

    it('should include the tags if provided', done => {
      serverShouldReceive('query_time:777|h|#app:web,feature:on', done)
      client.histogram('query_time', 777, ['app:web', 'feature:on'])
    })

    it('should include the sample rate and sample if provided', done => {
      serverShouldReceiveMultiple('query_time:777|h|@0.9|#app:web,feature:on', 2, done)
      times(100, () => {
        client.histogram('query_time', 777, 0.9, ['app:web', 'feature:on'])
      })
    })
  })

  describe('set', () => {
    it('should send the set value', done => {
      serverShouldReceive('users.unique:1234|s', done)
      client.set('users.unique', 1234)
    })

    it('should include the tags if provided', done => {
      serverShouldReceive('users.unique:1234|s|#app:web,feature:on', done)
      client.set('users.unique', 1234, ['app:web', 'feature:on'])
    })

    it('should include the sample rate and sample if provided', done => {
      serverShouldReceiveMultiple('users.unique:1234|s|@0.9|#app:web,feature:on', 2, done)
      times(100, () => {
        client.set('users.unique', 1234, 0.9, ['app:web', 'feature:on'])
      })
    })
  })

  describe('sendEvent', () => {
    it('Should send the event with provided', done => {
      const title = 'Things go bump'
      const text = 'Sometimes in the night'
      const now = Date.now()
      serverShouldReceive(`_e{${title.length},${text.length}}:${title}|${text}|d:${now}|p:normal|t:info`, done)
      client.sendEvent(title, text, {
        dateHappened: now,
      })
    })
  })

})
