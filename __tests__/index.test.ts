import { StreamReader, type TransformChunk } from '@alessiofrittoli/stream-reader'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AbortError } from '@alessiofrittoli/exception/abort'
import { Exception } from '@alessiofrittoli/exception'
import { ServerSentEvents } from '@/index'

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const streamError = new Exception({
	message: 'Test error',
	code: 0,
})

const streamData = async (sse: ServerSentEvents, error?: boolean): Promise<void> => {
	await sse.write({ message: 'somedata' })

	const sleepPromise = sleep(50)
	vi.advanceTimersByTime(50)
	await sleepPromise

	if (error) throw streamError

	await sse.write({ message: 'somedata 2' })
}

const transform: TransformChunk<Uint8Array, string> = chunk => Buffer.from(chunk).toString()

describe('ServerSentEvents', () => {
	let sse: ServerSentEvents

	beforeEach(() => {
		vi.useFakeTimers()
		/**
		 * Do not set `retry` here. most tests don't need `retry`.
		 *
		 * `retry` will cause constructor to write into the stream. `.write()` is an async method
		 * and cannot be awaited in constructors.
		 * also there might be some test that doesn't consume the stream so the the `.write()` will never resolve.
		 */
		sse = new ServerSentEvents()
	})

	afterEach(() => {
		vi.clearAllTimers().useRealTimers().resetAllMocks()
	})

	it('initializes with default headers and retry value', async () => {
		sse = new ServerSentEvents({ retry: 1000 })
		expect(sse.retry).toBe(1000)
		expect(sse.headers.get('Content-Type')).toBe('text/event-stream')

		sse.write({ message: 'somedata' })
		sse.close()

		const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
		const chunks = await reader.read()

		expect(chunks.includes('data: "retry: 1000\\n"\n\n')).toBe(true)
	})

	describe('ServerSentEvents.write()', () => {
		it('writes data with custom event', async () => {
			const data = { message: 'somedata' }

			sse.write(data, 'customEvent')
			sse.close()

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(chunks).include(`event: customEvent\ndata: ${JSON.stringify(data)}\n\n`)
		})
	})

	describe('ServerSentEvents.close()', () => {
		it('pushes "end" event and closes the writer', async () => {
			sse.write({ message: 'somedata' }).then(() => sse.close())

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(chunks).include('event: end\ndata: ""\n\n')
		})

		it('pushes "end" event once when called multiple times', async () => {
			const closeMock = vi.spyOn(sse.writer, 'close')

			sse.write({ message: 'somedata' }).then(() => {
				sse.close()
				sse.close()
				sse.close()
			})

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(chunks.filter(chunk => chunk.includes('event: end\ndata: ""\n\n')).length).toBe(1)
			expect(closeMock).toHaveBeenCalledTimes(1)
		})
	})

	describe('ServerSentEvents.error()', () => {
		it('pushes "error" event when an error occurs', async () => {
			streamData(sse, true)
				.then(() => sse.close())
				.catch(error => {
					sse.error(error)
				})

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(chunks).include(`event: error\ndata: ${JSON.stringify(streamError)}\n\n`)
		})

		it('pushes "error" event with original data if serializable', async () => {
			class CustomError extends Error {
				public constructor(message: string, options?: ErrorOptions) {
					super(message, options)
				}

				// key is to define this method here
				public toJSON(): unknown {
					return { message: this.message, cause: this.cause }
				}
			}

			const customError = new CustomError('Custom Error', { cause: 'ERR:UNKNOWN' })

			streamData(sse, true)
				.then(() => sse.close())
				.catch(() => sse.error(customError))

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(chunks).include(`event: error\ndata: ${JSON.stringify(customError)}\n\n`)
		})

		it('prints a warning if the given error is unserializable', async () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

			sse.error(new Error('Unserializable error.'))

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(warnSpy).toHaveBeenCalledWith(
				'The given error is unserializable. Make sure `toJSON` is defined in the given error.',
			)

			expect(chunks).include('event: error\ndata: {}\n\n')
		})

		it('automatically closes the stream when an error occurs', async () => {
			streamData(sse, true)
				.then(() => sse.close())
				.catch(error => sse.error(error))

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(chunks).include('event: end\ndata: ""\n\n')
		})

		it('pushes "error" event once when called multiple times and autoclose is set to true', async () => {
			streamData(sse, true)
				.then(() => sse.close())
				.catch(async error => {
					await sse.error(error)
					await sse.error(error)
					await sse.error(error)
				})

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(
				chunks.filter(chunk =>
					chunk.includes(`event: error\ndata: ${JSON.stringify(streamError)}\n\n`),
				).length,
			).toBe(1)
		})

		it('throws a TypeError when trying to push new data after an error occured and stream has been automatically closed', async () => {
			streamData(sse, true)
				.then(() => sse.close())
				.catch(async error => {
					await sse.error(error)
					expect(() => sse.write({ message: 'somedata after error' })).rejects.toThrow(
						new TypeError('Invalid state: Writer has been released'),
					)
				})
		})

		it('closes the stream if an error occurs during the push of "error" event', async () => {
			const sse = new ServerSentEvents()
			const writeMock = vi.spyOn(sse, 'write')
			const closeMock = vi.spyOn(sse.writer, 'close')

			writeMock.mockRejectedValueOnce(streamError)

			sse.error(streamError)

			await new StreamReader(sse.readable).read()

			expect(writeMock).toHaveBeenCalledWith(streamError, 'error')
			expect(closeMock).toHaveBeenCalledTimes(1)
		})

		it("doesn't close the stream if autoclose is set to false", async () => {
			const sse = new ServerSentEvents({ autoclose: false })

			const secondError = new Exception({
				message: 'Error #2',
				code: 2,
			})

			streamData(sse, true)
				.then(() => {
					sse.close()
				})
				.catch(async error => {
					sse.error(error).then(() => {
						expect(sse.closed).toBe(false)
					})

					sse.error(secondError).then(() => {
						expect(sse.closed).toBe(false)
					})

					sse.close()
				})

			const reader = new StreamReader<Uint8Array, string>(sse.readable, { transform })
			const chunks = await reader.read()

			expect(chunks).include(`event: error\ndata: ${JSON.stringify(streamError)}\n\n`)
			expect(chunks).include(`event: error\ndata: ${JSON.stringify(secondError)}\n\n`)
		})
	})

	describe('ServerSentEvents.abort()', () => {
		it('set `ServerSentEvents.closed` to `true`', async () => {
			await sse.abort()
			expect(sse.closed).toBe(true)
		})

		it('calls `ServerSentEvents.writer.abort()` with a default reason', async () => {
			const abortSpy = vi.spyOn(sse.writer, 'abort')
			await sse.abort()

			expect(abortSpy).toHaveBeenCalledWith(expect.any(AbortError))
		})

		it('calls `ServerSentEvents.writer.abort()` with a custom reason', async () => {
			const abortSpy = vi.spyOn(sse.writer, 'abort')
			const reason = 'Custom abort reason'
			await sse.abort(reason)

			expect(abortSpy).toHaveBeenCalledWith(
				expect.objectContaining(new AbortError({ message: 'Custom abort reason' })),
			)
		})

		it("doesn't release the `ServerSentEvents.writer` lock so `AbortError` pops out when trying to write new data", async () => {
			const streamPromise = streamData(sse)
				.then(async () => {
					await sse.abort('The user aborted the request.')
				})
				.catch(console.log)

			const reader = new StreamReader(sse.readable)

			await expect(reader.read()).rejects.toThrow(
				new AbortError({ message: 'The user aborted the request.' }),
			)

			await streamPromise

			await expect(sse.write({ message: 'some data after abort' })).rejects.toThrow(
				new AbortError({ message: 'The user aborted the request.' }),
			)
		})
	})
})
