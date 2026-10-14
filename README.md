<h1 align="center">Server-Sent Events ✅</h1>
<h2 align="center">
  Class Based implementation for <a href="https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events">Server-Sent events</a>
</h2>
<p align="center">
  <a href="https://npmjs.org/package/@alessiofrittoli/server-sent-events">
    <img src="https://img.shields.io/npm/v/@alessiofrittoli/server-sent-events" alt="Latest version"/>
  </a>
  <a href="https://coveralls.io/github/alessiofrittoli/exception">
    <img src="https://coveralls.io/repos/github/alessiofrittoli/exception/badge.svg" alt="Test coverage"/>
  </a>
  <a href="https://socket.dev/npm/package/@alessiofrittoli/server-sent-events/overview">
    <img src="https://socket.dev/api/badge/npm/package/@alessiofrittoli/server-sent-events" alt="Socket Security score"/>
  </a>
  <a href="https://npmjs.org/package/@alessiofrittoli/server-sent-events">
    <img src="https://img.shields.io/npm/dm/@alessiofrittoli/server-sent-events.svg" alt="npm downloads"/>
  </a>
  <a href="https://bundlephobia.com/package/@alessiofrittoli/server-sent-events">
    <img src="https://badgen.net/bundlephobia/dependency-count/@alessiofrittoli/server-sent-events" alt="Dependencies"/>
  </a>
  <a href="https://libraries.io/npm/%40alessiofrittoli%2Fexception">
    <img src="https://img.shields.io/librariesio/release/npm/@alessiofrittoli/server-sent-events" alt="Dependencies status"/>
  </a>
</p>
<p align="center">
  <a href="https://bundlephobia.com/package/@alessiofrittoli/server-sent-events">
    <img src="https://badgen.net/bundlephobia/min/@alessiofrittoli/server-sent-events" alt="minified"/>
  </a>
  <a href="https://bundlephobia.com/package/@alessiofrittoli/server-sent-events">
    <img src="https://badgen.net/bundlephobia/minzip/@alessiofrittoli/server-sent-events" alt="minizipped"/>
  </a>
  <a href="https://bundlephobia.com/package/@alessiofrittoli/server-sent-events">
    <img src="https://badgen.net/bundlephobia/tree-shaking/@alessiofrittoli/server-sent-events" alt="Tree shakable"/>
  </a>
</p>
<p align="center">
  <a href="https://github.com/sponsors/alessiofrittoli">
    <img src="https://img.shields.io/static/v1?label=Fund%20this%20package&message=%E2%9D%A4&logo=GitHub&color=%23DB61A2" alt="Fund this package"/>
  </a>
</p>

[sponsor-badge]: https://img.shields.io/static/v1?label=Fund%20this%20package&message=%E2%9D%A4&logo=GitHub&color=%23DB61A2
[sponsor-url]: https://github.com/sponsors/alessiofrittoli

### Table of Content

- [Getting started](#getting-started)
- [Development](#development)
  - [Local development](#local-development)
  - [Production build](#production-build)
  - [Unit tests](#unit-tests)
    - [Run tests with coverage](#run-tests-with-coverage)
  - [Contributing](#contributing)
  - [Security](#security)
- [Server-Side](#server-side)
  - [Streaming events data](#streaming-events-data)
  - [Writing into the stream](#writing-into-the-stream)
  - [Custom events](#custom-events)
  - [Closing the stream](#closing-the-stream)
  - [Error handling](#error-handling)
  - [Abort handling](#abort-handling)
- [Client-Side](#client-side)
  - [Reading server-sent events data](#reading-server-sent-events-data)
  - [Reading server-sent custom events data](#reading-server-sent-custom-events-data)
  - [Closing the EventSource](#closing-the-eventsource)
  - [EventSource Error handling](#eventsource-error-handling)
- [Credits](#made-with-)

---

### Getting started

Run the following command to start using `server-sent-events` in your projects:

```bash
npm i @alessiofrittoli/server-sent-events
```

or using `pnpm`

```bash
pnpm i @alessiofrittoli/server-sent-events
```

---

### Development

Run the following to start development

```shell
nvm use

pnpm i
```

#### Local development

Run the following

```shell
pnpm dev
```

This will generate unminified output code, sourcemaps and will enable source file watcher.

---

#### Production build

Run the following to create a local production build

```shell
pnpm build
```

This will generate minified output code without sourcemaps.

---

#### Unit tests

Run all the defined test suites by running the following:

```shell
# Run tests and watch file changes.
pnpm test:watch

# Run tests in a CI environment.
pnpm test:ci
```

---

##### Run tests with coverage

An HTTP server is then started to serve coverage files from `./coverage` folder.

⚠️ You may see a blank page the first time you run this command. Simply refresh the browser to see the updates.

```shell
pnpm test:coverage:serve
```

---

#### Contributing

Contributions are truly welcome!

Please refer to the [Contributing Doc](./CONTRIBUTING.md) for more information on how to start contributing to this project.

Help keep this project up to date with [GitHub Sponsor][sponsor-url].

[![GitHub Sponsor][sponsor-badge]][sponsor-url]

---

### Security

If you believe you have found a security vulnerability, we encourage you to **_responsibly disclose this and NOT open a public issue_**. We will investigate all legitimate reports. Email `security@alessiofrittoli.it` to disclose any security vulnerabilities.

---

### Server-Side

#### Streaming events data

With server-sent events, it's possible for a server to send new data to a web page at any time, by pushing messages to the web page. These incoming messages can be treated as Events + data inside the web page.

By creating a new instance of `ServerSentEvents` class you will get access to methods required to stream data to the client.

Simple return `ServerSentEvents.readable` in a `Response` instance to start streaming data.\
⚠️ Do not forget to return the proper response headers.\
⚠️ The streaming Response implementation depends on your back-end application.

```ts
import { ServerSentEvents } from '@alessiofrittoli/server-sent-events'

const sse = new ServerSentEvents()

return new Response(sse.readable, { headers: sse.headers })
```

---

#### Writing into the stream

By using the method `ServerSentEvents.write()` you can write and push any serializeable data to the client.\
This method will serialize your data before sending it to the client by using `JSON.stringify()`.\
The data is then read by the client by listening to the default `message` event on the `EventSource` instance (See **_[Reading server-sent events data](#reading-server-sent-events-data)_** for more information about reading received data).

For this example we are going to execute a function which simulates an asynchronous long task.

```ts
import { ServerSentEvents } from '@alessiofrittoli/server-sent-events'

export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const longRunningTask = async (stream: ServerSentEvents) => {
  await stream.write({ message: 'Started' })
  await sleep(1000)
  await stream.write({ message: 'Done 15%' })
  await sleep(1000)
  await stream.write({ message: 'Done 35%' })
  await sleep(1000)
  await stream.write({ message: 'Done 75%' })
  await sleep(1000)
  await stream.write({ message: 'Final data' })
}

const businessLogic = () => {
  const sse = new ServerSentEvents()

  longRunningTask(sse)

  return new Response(sse.readable)
}
```

---

#### Custom events

By default our data is implicitly sent over the default `message` event.

However, you may need to push new data into the same connection stream under a custom event.\
We can then specify its name as 2nd argument of the `ServerSentEvents.write()` method like so:

```ts
...

sse.write( { message: 'My data' }, 'customEvent' )

...
```

Notice that the client should now add a new listener to the `EventSource` instance referring to the name of the custom event.\
Please refer to the **_[Reading server-sent custom events data](#reading-server-sent-custom-events-data)_** section for more information.

---

#### Closing the stream

The `EventSource` API has a built-in automatic reconnection mechanism. If the connection to the server is lost (due to network issues, server restart, etc.), the `EventSource` will try to reconnect after a delay if the client is not explicitly calling the [EventSource.close()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close) method. By default, this delay is 3 seconds, see **_[Reconnection policies](#reconnection-policies)_** section for more information.

Due to the `EventSource` automatic recconnection mechanism the previous code will eventually end up in a sort of an infinite loop.

To tell the client that streaming is complete we can execute the `ServerSentEvents.close()` method.
This method will push a custom event named "end" in the stream and close the `ServerSentEvents.writer` (See **_[Custom events](#custom-events)_** section to learn more about custom events).\
⚠️ The client should listen for the "end" event and then close the `EventSource` connection with [EventSource.close()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close).

Since our previous function returns a void Promise, we can await it and then call the `ServerSentEvents.close()` method like so:

```ts
...

const businessLogic = () => {

  const sse = new ServerSentEvents()

  longRunningTask( sse )
      .then( () => {
          console.log( 'Streaming done.' )
          sse.close()
      } )

  return (
      new Response( sse.readable )
  )

}
```

---

#### Reconnection policies

The `EventSource` API has a built-in automatic reconnection mechanism. If the connection to the server is lost (due to network issues, server restart, etc.), the `EventSource` will try to reconnect after a delay if the client is not explicitly calling the [EventSource.close()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close) method. By default, this delay is 3 seconds but the server can override this timing by setting the "retry" policy.

When creating a new instance of `ServerSentEvents` we can specify the reconnection delay value in milliseconds to the "retry" property of the constructor like so:

```ts
const sse = new ServerSentEvents({ retry: 5000 })
```

---

#### Error handling

If an error occures in our `longRunningTask` example function we can use the `ServerSentEvents.error()` method to push a custom `error` event to the stream.

The client should listen the default `error` event on the `EventSource` to handle errors client side.

Good to know - Since the `ServerSentEvents.error()` will push an event with the name `error`, the client could use a single listener to listen default and custom errors (See **_[EventSource Error handling](#eventsource-error-handling)_** section to learn more about error handling on client).

> [!WARNING]
>
> Note that the stream will automatically close after calling the `ServerSentEvents.error()` method.
> To prevent stream autoclose on error you can set the `autoclose` option to `false` when creating a new instance of `ServerSentEvents`.

```ts
...

const businessLogic = () => {

  ...

  longRunningTask( sse )
      .then( () => {
          ...
      } )
      .catch( error => {
          console.error( 'Failed', error )
          sse.error( { message: error.message } )
      } )

  ...

}
```

---

#### Preventing stream autoclose on error

By default, the stream will automatically close after calling the `ServerSentEvents.error()` method.

To prevent stream autoclose on error you can set the `autoclose` option to `false` when creating a new instance of `ServerSentEvents`. This allows multiple errors to be sent.

```ts
...

const businessLogic = () => {

  const sse = new ServerSentEvents( { autoclose: false } )

  longRunningTask( sse )
      .then( () => {
          ...
      } )
      .catch( error => {
          console.error( 'Failed', error )
          sse.error( { message: error.message } )
          sse.error( { message: 'Another custom error' } )
      } )

  ...

}
```

---

#### Abort handling

Sometimes, error handling or awaiting a task to be finished before closing the stream could be not enough.
Let's assume your task is an infinite task (like returning the time once a second) and the user abort the `EventSource` request by closing the client or by calling the [EventSource.close()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close) method: your infinite task will be still running.

Most back-end server applications will allow you to listen for an abort signal that will be fired when the request has been aborted by the client by forcibly shutting down the connection or by calling the [EventSource.close()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close) method.
By listening for an abort signal, we can then execute the `ServerSentEvents.abort()` which will abort the `ServerSentEvents.writer` and prevent subsequent write events by setting the `ServerSentEvents.closed` flag to `true`.

For this example, we are going to desing a function that will push to the stream the current date in a ISO string format once a second.
In our interval we check if `ServerSentEvents.closed` has been set to `true` before pushing new data into the stream and resolve the Promise if so.

```ts
...

const timer = async ( stream: ServerSentEvents ) => {
  await stream.write( { message: new Date().toISOString() } )
  await new Promise<void>( resolve => {
    const interval = setInterval( () => {
      if ( stream.closed ) {
        clearInterval( interval )
        return resolve()
      }
      stream.write( { message: new Date().toISOString() } )
    }, 1000 )
  } )
}

const businessLogic = request => {

  ...

  request.signal.addEventListener( 'abort', event => {
    sse.abort( 'Request has been aborted from user.' )
  } )

  timer( sse )
    .then( () => {
        ...
    } )
    .catch( error => {
        console.error( 'Failed', error )
        if ( error.name === 'AbortError' ) return
        sse.error( { message: error.message } )
    } )

  ...

}
```

---

If you do not check if `ServerSentEvents.closed` is `true` before pushing new data, the `ServerSentEvents.write()` method will throw a `DOMException` with the given `AbortError` reason.

```ts
...

const timer = async ( stream: ServerSentEvents ) => {
  await stream.write( { message: new Date().toISOString() } )
  await new Promise<void>( resolve => {
    const interval = setInterval( () => {
      stream.write( { message: new Date().toISOString() } )
        .catch( error => {
          clearInterval( interval )
          return reject( error )
          } )
    }, 1000 )
  } )
}

const businessLogic = request => {

  ...

  request.signal.addEventListener( 'abort', event => {
    sse.abort( 'Request has been aborted from user.' )
  } )

  timer( sse )
      .then( () => {
        ...
      } )
      .catch( error => {
        console.error( 'Failed', error )
        if ( error.name === 'AbortError' ) {
          return console.log( 'Streaming stopped:', error.message )
        }
        sse.error( { message: error.message } )
      } )

  ...

}
```

---

### Client-Side

#### Reading server-sent events data

To listen server-sent events we can use the native [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) Web API.\
The connection remains open until closed by calling [EventSource.close()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close).

Once the connection is opened, incoming messages from the server are delivered to your code in the form of events. If there is an event field in the incoming message, the triggered event is the same as the event field value. If no event field is present, then a generic `message` event is fired.

```ts
const eventSource = new EventSource( new URL( ... ) )

eventSource.addEventListener( 'open', event => {
  console.log( 'Connection opened', event )
} )

eventSource.addEventListener( 'message', event => {
  const data = JSON.parse( event.data )
  console.log( '"message" event received data', data )
} )
```

---

#### Reading server-sent custom events data

To listen for incoming messages from the server sent over a custom event, we just add an event listener on the [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) instance like we've done in the previous example.

```ts
...

eventSource.addEventListener( 'customEvent', event => {
  const data = JSON.parse( event.data )
  console.log( '"customEvent" event received data', data )
} )
```

---

#### Closing the EventSource

We can call the [EventSource.close()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close) method arbitrarily or listen to the "end" event sent by the server to close the EventSource connection.

```ts
...

const cancelRequestButton = document.querySelector( '#cancel' )

cancelRequestButton.addEventListener( 'click', e vent=> {
  eventSource.close()
  console.log( 'User aborted the request.', eventSource.readyState )
} )
```

```ts
...

eventSource.addEventListener( 'end', event => {
  eventSource.close()
  console.log( '"end" event received', eventSource.readyState, event )
} )
```

---

#### EventSource Error handling

By default, errors are handled by listening to the "error" event on the EventSource instance.\
The server may use this event too to return handled errors occured on the server while running its tasks.

```ts
eventSource.addEventListener('error', event => {
  eventSource.close()
  console.log('"error" event', eventSource.readyState, event)
})
```

---

### Made with ☕

<table style='display:flex;gap:20px;'>
  <tbody>
    <tr>
      <td>
        <img alt="avatar" src='https://avatars.githubusercontent.com/u/35973186' style='width:60px;border-radius:50%;object-fit:contain;'>
      </td>
      <td>
        <table style='display:flex;gap:2px;flex-direction:column;'>
          <tbody>
              <tr>
                <td>
                  <a href='https://github.com/alessiofrittoli' target='_blank' rel='noopener'>Alessio Frittoli</a>
                </td>
              </tr>
              <tr>
                <td>
                  <small>
                    <a href='https://alessiofrittoli.it' target='_blank' rel='noopener'>https://alessiofrittoli.it</a> |
                    <a href='mailto:info@alessiofrittoli.it' target='_blank' rel='noopener'>info@alessiofrittoli.it</a>
                  </small>
                </td>
              </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
