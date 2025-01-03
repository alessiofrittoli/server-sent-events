import { ServerSentEvents } from '@/index'
import { StreamReader } from '@alessiofrittoli/stream-reader'

const sleep = ( ms: number ): Promise<void> => new Promise( resolve => setTimeout( resolve, ms ) )

const streamData = async ( sse: ServerSentEvents, error?: boolean ) => {
	await sse.push( { message: 'somedata' } )
	await sleep( 50 )
	if ( error ) throw new Error( 'Test error' )
	await sse.push( { message: 'somedata 2' } )
}

describe( 'ServerSentEvents', () => {
	let sse: ServerSentEvents

	beforeEach( () => {
		sse = new ServerSentEvents( { retry: 1000 } )
	} )


	it( 'initializes with default headers and retry value', async () => {
		expect( sse.retry ).toBe( 1000 )
		expect( sse.headers.get( 'Content-Type' ) ).toBe( 'text/event-stream' )

		sse.push( { message: 'somedata' } )
		sse.close()

		const reader = new StreamReader<Uint8Array, string>( sse.stream.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
		expect( chunks.includes( 'retry: 1000\n' ) ).toBe( true )
	} )

} )


describe( 'ServerSentEvents.push()', () => {
	let sse: ServerSentEvents

	beforeEach( () => {
		sse = new ServerSentEvents( { retry: 1000 } )
	} )


	it( 'pushes data with custom event', async () => {
		const data = { message: 'somedata' }

		sse.push( data, 'customEvent' )
		sse.close()

		const reader = new StreamReader<Uint8Array, string>( sse.stream.readable )
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
		
		sse.push( { message: 'somedata' } )
			.then( () => sse.close() )

		const reader = new StreamReader<Uint8Array, string>( sse.stream.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
					
		expect( chunks.includes( 'event: end\ndata: ""\n\n' ) ).toBe( true )
	} )


	it( 'pushes "end" event once when called multiple times', async () => {

		const closeMock = jest.spyOn( sse.writer, 'close' )
		
		sse.push( { message: 'somedata' } )
			.then( () => {
				sse.close()
				sse.close()
				sse.close()
			} )

		const reader = new StreamReader<Uint8Array, string>( sse.stream.readable )
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

		const reader = new StreamReader<Uint8Array, string>( sse.stream.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )	

		expect( chunks.includes( 'event: error\ndata: "Test error"\n\n' ) ).toBe( true )
	} )


	it( 'pushes "end" event when an error occurs', async () => {

		streamData( sse, true )
			.then( () => sse.close() )
			.catch( error => sse.error( error ) )


		const reader = new StreamReader<Uint8Array, string>( sse.stream.readable )
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


		const reader = new StreamReader<Uint8Array, string>( sse.stream.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
	
		expect(
			chunks.filter( chunk => chunk.includes( 'event: error\ndata: "Test error"\n\n' ) ).length
		).toBe( 1 )
		
	} )


	it( 'doesn\'t push new data after an error occurs', async () => {

		streamData( sse, true )
			.then( () => sse.close() )
			.catch( async error => {
				await sse.error( error )
				sse.push( { message: 'somedata after error' } )
			} )

		const reader = new StreamReader<Uint8Array, string>( sse.stream.readable )
		const chunks = await reader.read( chunk => Buffer.from( chunk ).toString() )
	
		expect( chunks.includes( 'data: {"message":"somedata after error"}\n\n' ) ).toBe( false )
	} )


	it( 'closes the stream if an error occurs during the push of "error" event', async () => {
		const sse = new ServerSentEvents()
		const error = new Error( 'Test error' )
		const writeMock = jest.spyOn( sse, 'push' )
		const closeMock = jest.spyOn( sse.writer, 'close' )

		writeMock.mockRejectedValueOnce( error )

		sse.error( error )

		await new StreamReader( sse.stream.readable ).read()

		expect( writeMock ).toHaveBeenCalledWith( 'Test error', 'error' )
		expect( closeMock ).toHaveBeenCalledTimes( 1 )
	} )
	
} )


describe( 'ServerSentEvents.abort()', () => {
	let sse: ServerSentEvents

	beforeEach( () => {
		sse = new ServerSentEvents()
	} )

	it( 'abort should set closed to true', async () => {
		await sse.abort()
		expect( sse.closed ).toBe( true )
	} )


	it( 'abort should call writer.abort with default reason', async () => {
		const abortSpy = jest.spyOn( sse.writer, 'abort' )
		await sse.abort()
		expect( abortSpy )
			.toHaveBeenCalledWith(
				expect.objectContaining( { message: 'Streming writer aborted.', name: 'AbortError' } )
			)
	} )


	it( 'abort should call writer.abort with provided reason', async () => {
		const abortSpy	= jest.spyOn( sse.writer, 'abort' )
		const reason	= 'Custom abort reason'
		await sse.abort( reason )

		expect( abortSpy )
			.toHaveBeenCalledWith(
				expect.objectContaining( { message: reason, name: 'AbortError' } )
			)
	} )

	
	it( 'abort should release writer lock', async () => {
		const releaseLockSpy = jest.spyOn( sse.writer, 'releaseLock' )
		await sse.abort()
		expect( releaseLockSpy ).toHaveBeenCalled()
	} )
} )