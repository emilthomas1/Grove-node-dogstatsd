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
const metrics = new DogStatsD()
metrics.increment('active_users')
```

*Note:* If you want to use this library as a generic StatsD client it will work just fine. Just don't pass in `tags` parameters or use the `histogram` method.

### Docs
See the [Datadog DogStatsD guide](http://docs.datadoghq.com/guides/dogstatsd/) for information on using these methods.

### API

Aside from the constructor and `sendEvent`, the `options` parameter is a hash that may include `tags` and `sampleRate`

#### *constructor*`(host='localhost', port=8125, [socket], [options])`
If a `socket` parameter is not provided a UDP socket is created and cleaned up as needed.

The last parameter is an optional `options` object, which may have the following properties:

- `globalTags`: an array of strings to be included as tags with every metric sent

#### `increment(stat, delta=1, [options])`
If you're passing `options` you must also pass  `delta`

#### `decrement(stat, delta=1, [options])`
`options` is a hash that may include `tags` and `sampleRate`
If you're passing `options` you must also pass  `delta`

#### `set(stat, value, [options])`

#### `gauge(stat, value, [options])`

#### `timing(stat, value, [options])`

#### `createTimer(stat, [options])`
Returns an object with a `stop` method to call. Then calls `timing` under the hood with the measured change in time. Uses `process.hrtime` for high-resolution timing.

#### `histogram(stat, value, [options])`

#### `sendEvent(title, text, [options])`
Options include:

- `dateHappened=Date.now()`
- `priority='normal'`
- `type='info'`
- `hostname`
- `aggregationKey`
- `sourceTypeName`
- `tags`

### Error handling
If no `socket` argument is given to the constructor, then a UDP socket is created as needed when sending data to the Datadog agent. We place a no-op function as the error handler to swallow any errors that may occur on the socket.

If a `socket` argument is given, then it's up to the user to provide error handling mechanisms. A client's socket is accessible from the `client.socket` property.

## Prior Art
- [node-statsd](https://github.com/sivy/node-statsd)
- [node-dogstatsd](https://github.com/joybro/node-dogstatsd)
- [lynx](https://github.com/dscape/lynx)
