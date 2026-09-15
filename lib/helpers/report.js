/**
 * Report an error we can carry on past: always warned about, and emitted as
 * well wherever someone is listening.
 *
 * An unheard "error" event throws, which from inside a socket callback cannot
 * be caught and takes the host process with it - the very thing being avoided.
 */
export default function report(emitter, message, error) {
	console.warn(message + ':', error?.message ?? error);

	if (emitter.listenerCount('error')) {
		emitter.emit('error', error);
	}
}
