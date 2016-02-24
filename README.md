# `@grove/dogstatsd`

A Node.js module for interacting with a local [Datadog](http://www.datadoghq.com) StatsD agent over UDP.

Datadog extends StatsD with additional features — histograms and tags. This client is an extension of a general StatsD client to work with their implementation.

## Installation

```sh
npm install @grove/dogstatsd
```

## Usage

```js
const DogStatsD = require('@grove/dogstatsd')
const client = new DogStatsD('foobarbaz.com', 4242)
// { host: 'foobarbaz.com', port: 4242 }
client.increment('node_test.int')
client.incrementBy('node_test.int', 7)
client.decrement('node_test.int')
client.decrementBy('node_test.int', 12)
client.timing('node_test.some_service.task.time', 500) // time in millis
client.histogram('node_test.some_service.data', 100) // works only with datadog' StatsD
client.increment('node_test.int', 1, ['tag:one']) // works only with datadog' StatsD
```

### Error handling
If no `socket` argument is given to the constructor, then a UDP socket is created as needed when sending data to the Datadog agent. We place a no-op function as the error handler to swallow any errors that may occur on the socket.

If a `socket` argument is given, then it's up to the user to provide error handling mechanisms. A client's socket is accessible from the `client.socket` property.

## Prior Art
- [node-statsd](https://github.com/sivy/node-statsd)
- [node-dogstatsd](https://github.com/joybro/node-dogstatsd)

## License

MIT
