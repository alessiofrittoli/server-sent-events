import { ServerSentEvents } from '@/index'
import { StreamReader } from '@alessiofrittoli/stream-reader'

const sleep = ( ms: number ): Promise<void> => new Promise( resolve => setTimeout( resolve, ms ) )

const streamData = async ( sse: ServerSentEvents, error?: boolean ) => {
	await sse.write( { message: 'somedata' } )
	await sleep( 50 )
	if ( error ) throw new Error( 'Test error' )
	await sse.write( { message: 'somedata 2' } )
}

describe( 'ServerSentEvents', () => {
	let sse: ServerSentEvents

	beforeEach( () => {
		sse = new ServerSentEvents( { retry: 1000 } )
	} )


	it( 'initializes with default headers and retry value', async () => {
		expect( sse.retry ).toBe( 1000 )
		expect( sse.headers.get( 'Content-Type' ) ).toBe( 'text/event-stream' )

		sse.write( { message: 'somedata' } )
		sse.close()

		const reader = new StreamReader<Uint8Array, string>( sse.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
		
		expect( chunks.includes( 'retry: 1000\n' ) ).toBe( true )
	} )

} )


describe( 'ServerSentEvents.write()', () => {
	let sse: ServerSentEvents

	beforeEach( () => {
		sse = new ServerSentEvents( { retry: 1000 } )
	} )


	it( 'writes data with custom event', async () => {
		const data = { message: 'somedata' }

		sse.write( data, 'customEvent' )
		sse.close()

		const reader = new StreamReader<Uint8Array, string>( sse.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )

		expect( chunks.includes( `event: customEvent\ndata: ${ JSON.stringify( data ) }\n\n` ) ).toBe( true )
	} )

} )


describe( 'ServerSentEvents.close()', () => {
	let sse: ServerSentEvents

	beforeEach( () => {
		sse = new ServerSentEvents( { retry: 1000 } )
	} )


	it( 'pushes "end" event and closes the writer', async () => {
		
		sse.write( { message: 'somedata' } )
			.then( () => sse.close() )

		const reader = new StreamReader<Uint8Array, string>( sse.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
					
		expect( chunks.includes( 'event: end\ndata: ""\n\n' ) ).toBe( true )
	} )


	it( 'pushes "end" event once when called multiple times', async () => {

		const closeMock = jest.spyOn( sse.writer, 'close' )
		
		sse.write( { message: 'somedata' } )
			.then( () => {
				sse.close()
				sse.close()
				sse.close()
			} )

		const reader = new StreamReader<Uint8Array, string>( sse.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
				
		expect(
			chunks.filter( chunk => chunk.includes( 'event: end\ndata: ""\n\n' ) ).length
		).toBe( 1 )
		expect( closeMock ).toHaveBeenCalledTimes( 1 )
	} )

} )


describe( 'ServerSentEvents.error()', () => {

	let sse: ServerSentEvents

	beforeEach( () => {
		sse = new ServerSentEvents( { retry: 1000 } )
	} )


	it( 'pushes "error" event when an error occurs', async () => {
		streamData( sse, true )
			.then( () => sse.close() )
			.catch( error => sse.error( error ) )

		const reader = new StreamReader<Uint8Array, string>( sse.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )

		expect( chunks.includes( 'event: error\ndata: "Test error"\n\n' ) ).toBe( true )
	} )


	it( 'pushes "error" event with original data if serializable', async () => {
		class CustomError extends Error
		{
			constructor( message: string, options?: ErrorOptions )
			{
				super( message, options )
			}

			toJSON()
			{
				return { message: this.message, cause: this.cause }
			}
		}

		streamData( sse, true )
			.then( () => sse.close() )
			.catch( () => sse.error( new CustomError( 'Custom Error', { cause: 'ERR:UNKNOWN' } ) ) )

		const reader = new StreamReader<Uint8Array, string>( sse.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )

		expect(
			chunks.includes( 'event: error\ndata: {"message":"Custom Error","cause":"ERR:UNKNOWN"}\n\n' )
		).toBe( true )

	} )


	it( 'pushes "end" event when an error occurs', async () => {

		streamData( sse, true )
			.then( () => sse.close() )
			.catch( error => sse.error( error ) )


		const reader = new StreamReader<Uint8Array, string>( sse.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
		
		expect( chunks.includes( 'event: end\ndata: ""\n\n' ) ).toBe( true )
	} )


	it( 'pushes "error" event once when called multiple times', async () => {

		streamData( sse, true )
			.then( () => sse.close() )
			.catch( async error => {
				await sse.error( error )
				await sse.error( error )
				await sse.error( error )
			} )


		const reader = new StreamReader<Uint8Array, string>( sse.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
	
		expect(
			chunks.filter( chunk => chunk.includes( 'event: error\ndata: "Test error"\n\n' ) ).length
		).toBe( 1 )
		
	} )


	it( 'throws a TypeError when trying to push new data after an error occured', async () => {

		streamData( sse, true )
			.then( () => sse.close() )
			.catch( async error => {
				await sse.error( error )
				expect( () => sse.write( { message: 'somedata after error' } ) )
					.rejects.toThrow( new TypeError( 'Invalid state: Writer has been released' ) )
			} )

	} )


	it( 'closes the stream if an error occurs during the push of "error" event', async () => {
		const sse = new ServerSentEvents()
		const error = new Error( 'Test error' )
		const writeMock = jest.spyOn( sse, 'write' )
		const closeMock = jest.spyOn( sse.writer, 'close' )

		writeMock.mockRejectedValueOnce( error )

		sse.error( error )

		await new StreamReader( sse.readable ).read()

		expect( writeMock ).toHaveBeenCalledWith( 'Test error', 'error' )
		expect( closeMock ).toHaveBeenCalledTimes( 1 )
	} )
	
} )


describe( 'ServerSentEvents.abort()', () => {
	let sse: ServerSentEvents

	beforeEach( () => {
		sse = new ServerSentEvents()
	} )

	it( 'set `ServerSentEvents.closed` to `true`', async () => {
		await sse.abort()
		expect( sse.closed ).toBe( true )
	} )


	it( 'calls `ServerSentEvents.writer.abort()` with a default reason', async () => {
		const abortSpy = jest.spyOn( sse.writer, 'abort' )
		await sse.abort()
		expect( abortSpy )
			.toHaveBeenCalledWith(
				expect.objectContaining( { message: 'Stream writer aborted.', name: 'AbortError' } )
			)
	} )


	it( 'calls `ServerSentEvents.writer.abort()` with a custom reason', async () => {
		const abortSpy	= jest.spyOn( sse.writer, 'abort' )
		const reason	= 'Custom abort reason'
		await sse.abort( reason )

		expect( abortSpy )
			.toHaveBeenCalledWith(
				expect.objectContaining( { message: reason, name: 'AbortError' } )
			)
	} )

	
	it( 'doesn\'t release the `ServerSentEvents.writer` lock so `AbortError` pops out when trying to write new data', async () => {
		const sse = new ServerSentEvents()
		const reader = new StreamReader<Uint8Array, string>( sse.readable )

		streamData( sse )
			.then( async () => {
				await sse.abort( 'The user aborted the request.' )
				expect( () => sse.write( { message: 'some data after abort' } ) )
					.rejects.toThrow( new DOMException( 'The user aborted the request.', 'AbortError' ) )
			} )

		expect( () => reader.read() )
			.rejects.toThrow( new DOMException( 'The user aborted the request.', 'AbortError' ) )
		
	} )

} )