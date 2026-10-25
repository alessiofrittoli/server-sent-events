import { Stream } from '@alessiofrittoli/stream-writer'

export interface ServerSentEventsProps {
	/**
	 * Defines the delay time in milliseconds after which the client attempts to reconnect to the server.
	 *
	 */
	retry?: number
	/**
	 * Defines whether to automatically close the stream when `ServerSentEvents.error()` is called.
	 *
	 * @default true
	 */
	autoclose?: boolean
}

export type Directive = `${string}: ${string}\n`

/**
 * Server-Sent Events base class.
 *
 * This class extends the [`Stream`](https://npmjs.com/package/@alessiofrittoli/stream-writer) interface with additional convenience methods.
 *
 * [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
 *
 * [Using Server-Sent Events - MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
 *
 * @usage Server-Side usage
 * ```ts
 * // create a new instance.
 * const sse = new ServerSentEvents()
 * // write into the the stream with the default `message` event.
 * sse.write( { ... } )
 * // write into the the stream with the custom `customEvent` event.
 * sse.write( { ... }, 'customEvent' )
 * // send handled error event.
 * sse.error( { ... } )
 * // abort stream writer.
 * sse.abort( 'Abort reason custom message.' )
 * // emit `end` event and close the stream.
 * sse.close()
 * ```
 *
 * @usage Client-Side usage
 * ```ts
 * const eventSource = new EventSource( new URL( ... ) )
 * // listen for `open` connection event.
 * eventSource.addEventListener( 'open', event => { ... } )
 * // listen for `message` default event.
 * eventSource.addEventListener( 'message', event => { ... } )
 * // listen for `customEvent` custom event.
 * eventSource.addEventListener( 'customEvent', event => { ... } )
 * // listen for `end` event. This event is emitted by the server when needed.
 * eventSource.addEventListener( 'end', event => { eventSource.close() ... } )
 * // listen for `error` event.
 * eventSource.addEventListener( 'error', event => { eventSource.close() ... } )
 * ```
 */
export class ServerSentEvents extends Stream<string, Uint8Array> implements ServerSentEventsProps {
	/**
	 * The ServerSentEvents {@link TextEncoder} instance.
	 *
	 */
	public readonly encoder: TextEncoder
	public readonly retry
	public readonly autoclose

	/**
	 * Indicates whether the connection is in the process of closing.
	 * This flag is internally used to prevent multiple close operations from being initiated.
	 */
	private closing: boolean = false

	/**
	 * Constructs a new instance of the ServerSentEvents class.
	 *
	 * @param props Optional properties to configure the ServerSentEvents instance.
	 *
	 * If the `retry` property is provided, it writes the formatted retry interval to the stream.
	 */
	public constructor(props?: ServerSentEventsProps) {
		const encoder = new TextEncoder()

		super({
			transform(chunk, controller) {
				controller.enqueue(encoder.encode(chunk))
			},
		})

		this.encoder = encoder
		this.closed = false
		this.retry = props?.retry ? Math.max(1000, props.retry) : undefined
		this.autoclose = props?.autoclose ?? true

		this.headers.set('Content-Type', 'text/event-stream')

		if (this.retry) {
			this.write(this.formatRetry(this.retry)).catch(() => undefined)
		}
	}

	/**
	 * Write data in the stream.
	 *
	 * A custom `event` name can be passed as 2nd argument.
	 *
	 * Standard event can be listened to the `message` event type.
	 * ```ts
	 * EventSource.addEventListener<"message">(type: "message", listener: (this: EventSource, ev: Event) => any, options?: boolean | AddEventListenerOptions): void
	 * ```
	 *
	 * Make sure to add a `{event}` type event listener on your {@link EventSource.addEventListener} instance on the client-side.
	 * ```ts
	 * EventSource.addEventListener<"customEvent">(type: "customEvent", listener: (this: EventSource, ev: Event) => any, options?: boolean | AddEventListenerOptions): void
	 * ```
	 *
	 * @param data The data to write.
	 * @param event ( Optional ) A custom event name.
	 *
	 * @returns	A new Promise with the `ServerSentEvents` instance for chaining purposes.
	 */
	public override write(data: unknown, event?: string): Promise<this> {
		if (event) {
			return super.write(this.formatEvent(event) + this.formatData(data))
		}
		return super.write(this.formatData(data))
	}

	/**
	 * Write error data in an error event stream.
	 *
	 * Make sure to add a 'error' type event listener on your {@link EventSource.addEventListener} instance on the client-side.
	 * ```ts
	 * EventSource.addEventListener<"error">(type: "error", listener: (this: EventSource, ev: Event) => any, options?: boolean | AddEventListenerOptions): void
	 * ```
	 *
	 * @param error The error data to write.
	 */
	public async error(error: unknown): Promise<this> {
		if (this.closed) return this

		try {
			const isUnserializable = JSON.stringify(error) === '{}'

			if (isUnserializable) {
				console.warn(
					'The given error is unserializable. Make sure `toJSON` is defined in the given error.',
				)
			}

			await this.write(error, 'error')

			if (this.autoclose) {
				return await this.close()
			}

			return this
		} catch {
			return this.close()
		}
	}

	/**
	 * Closes the writer if it is not already closed or in the process of closing.
	 * Sets the `isClosing` flag to true to prevent multiple close operations.
	 * Pushes an 'end' event to signal the end of the stream.
	 * Closes the writer and releases the lock.
	 * Resets the `isClosing` flag to false after the operation.
	 *
	 * Make sure to add a 'end' type event listener on your {@link EventSource.addEventListener} instance on the client-side to close the {@link EventSource} by calling {@link EventSource.close()}.
	 * ```ts
	 * EventSource.addEventListener<"end">(type: "end", listener: (this: EventSource, ev: Event) => any, options?: boolean | AddEventListenerOptions): void
	 * ```
	 * @returns A new Promise with the current `ServerSentEvents` instance for chaining purposes.
	 */
	public override async close(): Promise<this> {
		if (this.closed || this.closing) return this
		this.closing = true
		try {
			await this.write('', 'end')
		} finally {
			this.closing = false
			// oxlint-disable-next-line no-unsafe-finally
			return super.close()
		}
	}

	/**
	 * Formats a directive and its value as a string.
	 *
	 * @param directive - The directive to be formatted.
	 * @param value - The value associated with the directive.
	 * @returns A formatted string in the form of "directive: value\n".
	 */
	private formatDirective(directive: string, value: string | number | boolean): Directive {
		return `${directive}: ${value}\n`
	}

	/**
	 * Formats an event string into a server-sent event directive.
	 *
	 * @param event - The event string to be formatted.
	 * @returns The formatted event directive string.
	 */
	private formatEvent(event: string): Directive {
		return this.formatDirective('event', event)
	}

	/**
	 * Formats the retry directive with the specified time in milliseconds.
	 *
	 * @param ms - The time in milliseconds to wait before retrying the connection.
	 * @returns The formatted retry directive string.
	 */
	private formatRetry(ms: number): Directive {
		return this.formatDirective('retry', ms)
	}

	/**
	 * Formats the given data as a server-sent event data directive.
	 *
	 * @param data - The data to be formatted.
	 * @returns A string representing the formatted data directive.
	 */
	private formatData(data: unknown): string {
		return this.formatDirective('data', JSON.stringify(data)) + '\n'
	}
}
