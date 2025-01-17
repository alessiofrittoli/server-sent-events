/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ServerSentEventsProps
{
	/** Defines the delay time in milliseconds after which the client attempts to reconnect to the server. */
	retry?: number
}


/**
 * Server-Sent Events base class.
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
export class ServerSentEvents implements ServerSentEventsProps
{
	/** The ServerSentEvents {@link TransformStream} instance. */
	stream: TransformStream<Uint8Array, Uint8Array>
	/** The ServerSentEvents {@link WritableStreamDefaultWriter} instance. */
	writer: WritableStreamDefaultWriter<Uint8Array>
	/** The ServerSentEvents {@link TextEncoder} instance. */
	encoder: TextEncoder
	/** Flag whether {@link WritableStreamDefaultWriter} has been closed or not. */
	closed: boolean
	retry
	/** Default headers sent to the client. */
	headers: Headers

	/**
	 * Indicates whether the connection is in the process of closing.
	 * This flag is internally used to prevent multiple close operations from being initiated.
	 */
	private isClosing: boolean = false


	/**
	 * Constructs a new instance of the ServerSentEvents class.
	 * 
	 * @param props - Optional properties to configure the ServerSentEvents instance.
	 * 
	 * @property stream - A TransformStream used for handling the event stream.
	 * @property writer - A WritableStreamDefaultWriter for writing to the stream.
	 * @property encoder - A TextEncoder for encoding text to Uint8Array.
	 * @property closed - A boolean indicating whether the stream is closed.
	 * @property retry - An optional retry interval for the event stream.
	 * @property headers - A Headers object containing the headers for the event stream.
	 * 
	 * If the `retry` property is provided, it writes the formatted retry interval to the stream.
	 */
	constructor( props?: ServerSentEventsProps )
	{
		this.stream		= new TransformStream<Uint8Array>()
		this.writer		= this.stream.writable.getWriter()
		this.encoder	= new TextEncoder()
		this.closed		= false
		this.retry		= props?.retry
		this.headers	= new Headers( {
			'Content-Type'		: 'text/event-stream',
			'Connection'		: 'keep-alive',
			'Cache-Control'		: 'no-cache, no-transform',
			'X-Accel-Buffering'	: 'no',
			'Content-Encoding'	: 'none',
		} )

		if ( this.retry ) {
			this.write( this.formatRetry( this.retry ) )
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
	 * @param	data	The data to write.
	 * @param	event	( Optional ) A custom event name.
	 * @returns	A new Promise with the `ServerSentEvents` instance for chaining purposes.
	 */
	async push( data: any, event?: string )
	{
		if ( this.closed ) return this
		if ( event ) {
			return (
				this.write(
					this.formatEvent( event )
					+ this.formatData( data )
				)
			)
		}
		return this.write( this.formatData( data ) )
	}


	/**
	 * Writes the given data to the writer after encoding it.
	 *
	 * @param data - The string data to be written.
	 * @returns A promise that resolves when the data has been written.
	 */
	private async write( data: string )
	{
		return (
			this.writer.ready
				.then( () => (
					this.writer.write(
						this.encoder.encode( data )
					)
				) )
				.then( () => this )
		)
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
	async error( error: Error )
	{
		if ( this.closed ) return this

		try {			
			if ( JSON.stringify( error ) === '{}' ) {
			await this.push( error.message, 'error' )
			} else {
				await this.push( error, 'error' )
			}
			await this.close()
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch ( error ) {
			await this.writer.close()
			this.writer.releaseLock()
			this.closed = true
		}
		return this
	}


	/**
	 * Aborts the {@link ServerSentEvents.writer}.
	 *
	 * @param reason - An optional string providing the reason for the abort.
	 * @returns A new Promise with the current `ServerSentEvents` instance for chaining purposes.
	 */
	async abort( reason?: string )
	{
		this.closed = true
		await this.writer.abort( new DOMException( reason || 'Streming writer aborted.', 'AbortError' ) )
		this.writer.releaseLock()
		return this
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
	async close()
	{
		if ( this.closed || this.isClosing ) return this
		this.isClosing = true
		try {
			await this.push( '', 'end' )
			await this.writer.close()
			this.closed = true
			this.writer.releaseLock()
		} finally {
			this.isClosing = false
		}
		return this
	}


	/**
	 * Formats a directive and its value as a string.
	 *
	 * @param directive - The directive to be formatted.
	 * @param value - The value associated with the directive.
	 * @returns A formatted string in the form of "directive: value\n".
	 */
	private formatDirective( directive: string, value: string | number | boolean )
	{
		return `${ directive }: ${ value }\n`
	}


	/**
	 * Formats an event string into a server-sent event directive.
	 *
	 * @param event - The event string to be formatted.
	 * @returns The formatted event directive string.
	 */
	private formatEvent( event: string )
	{
		return this.formatDirective( 'event', event )
	}


	/**
	 * Formats the retry directive with the specified time in milliseconds.
	 *
	 * @param ms - The time in milliseconds to wait before retrying the connection.
	 * @returns The formatted retry directive string.
	 */
	private formatRetry( ms: number )
	{
		return this.formatDirective( 'retry', ms )
	}


	/**
	 * Formats the given data as a server-sent event data directive.
	 *
	 * @param data - The data to be formatted.
	 * @returns A string representing the formatted data directive.
	 */
	private formatData( data: any )
	{
		return this.formatDirective( 'data', JSON.stringify( data ) ) + '\n'
	}
}