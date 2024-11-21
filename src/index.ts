interface ServerSentEventsProps
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
class ServerSentEvents implements ServerSentEventsProps
{
	/** The ServerSentEvents {@link TransformStream} instance. */
	stream: TransformStream
	/** The ServerSentEvents {@link WritableStreamDefaultWriter} instance. */
	writer: WritableStreamDefaultWriter<any>
	/** The ServerSentEvents {@link TextEncoder} instance. */
	encoder: TextEncoder
	/** Flag whether {@link WritableStreamDefaultWriter} has been closed or not. */
	closed: boolean
	retry
	/** Default headers sent to the client. */
	headers: Headers


	constructor( props?: ServerSentEventsProps )
	{
		this.stream		= new TransformStream()
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
		if ( this.closed ) return

		if ( event ) {
			await (
				this.write(
					this.formatEvent( event )
					+ this.formatData( data )
				)
			)
			await this.writer.ready
			return this
		}

		await this.write( this.formatData( data ) )
		await this.writer.ready

		return this
	}


	private write( data: string )
	{
		return (
			this.writer.write(
				this.encoder.encode( data )
			)
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
	async error( error: any )
	{
		try {
			await this.push( error, 'error' )
			await this.close()
		} catch ( error ) {
			console.error( 'Error writing or closing stream:', error )
			await this.writer.close()
			this.closed = true
		}
	}


	/**
	 * Abort the {@link ServerSentEvents.writer}.
	 * 
	 * @param reason The Abort reason message.
	 */
	async abort( reason?: string )
	{
		this.closed = true
		await this.writer.abort( new DOMException( reason || 'Streming writer aborted.', 'AbortError' ) )
	}


	/**
	 * Write `end` event in the stream and close the {@link ServerSentEvents.writer}.
	 * 
	 * Make sure to add a 'end' type event listener on your {@link EventSource.addEventListener} instance on the client-side to close the {@link EventSource} by calling {@link EventSource.close()}.
	 * ```ts
	 * EventSource.addEventListener<"end">(type: "end", listener: (this: EventSource, ev: Event) => any, options?: boolean | AddEventListenerOptions): void
	 * ```
	 */
	async close()
	{
		if ( this.closed ) return
		await this.push( '', 'end' )
		await this.writer.close()
		this.closed = true
	}


	private formatDirective( directive: string, value: any )
	{
		return `${ directive }: ${ value }\n`
	}


	private formatEvent( event: string )
	{
		return this.formatDirective( 'event', event )
	}


	private formatRetry( ms: number )
	{
		return this.formatDirective( 'retry', ms )
	}


	private formatData( data: any )
	{
		return this.formatDirective( 'data', JSON.stringify( data ) ) + '\n'
	}
}


export default ServerSentEvents