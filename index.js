var fspath = require('path');
var notifications = require('freedesktop-notifications');
var promisify = require('util').promisify;

module.exports = function(options) {
	var settings = {
		title: 'Rollup',
		bodyStart: 'Compiling...',
		icon: 'appointment-new',
		prefixLoading: '<b>⭘ </b>',
		prefixDone: '<b>✔</b> ',
		prefixError: '<b>✘</b> ',
		update: (progress, notification) => {
			notification.set({
				body: Object.keys(progress)
					.filter(k => !k.startsWith('$'))
					.map(k =>
						(
							progress[k] == 'load' ? settings.prefixLoading
							: progress[k] == 'transform' ? settings.prefixDone
							: settings.prefixError
						) + k
					).join('\n'),
			});
		},
		render: notification => notification.push(),
		filter: id => !id.startsWith("\u0000") && !/:|\?/.test(id),
		baseDir: '',
		timeout: 10 * 1000,
		...options,
	};

	var progressStack = {
		$loaded: 0,
		$transformed: 0,
	};

	var notification;

	return {
		name: 'progress-notify',
		buildStart: ()=>
			promisify(notifications.init)() // Wait for DBus connection
				.then(()=> { // Push initial notification
					notification = notifications
						.createNotification( {
							summary: settings.title,
							body: settings.bodyStart,
							icon: settings.icon,
							timeout: settings.timeout,
						})
						.push()
				})
				.then(()=> new Promise(resolve => {
					var checkId = ()=> {
						if (notification.id) {
							return resolve();
						} else {
							setTimeout(checkId, 10);
						}
					};
					checkId(); // Loop until an ID is allocated
				})),
		buildEnd: ()=> {
			if (notification && notification.id) notification.close();
		},
		load: id => {
			if (!settings.filter(id)) return; // Ignore meta files
			var path = fspath.relative(settings.baseDir, id);
			progressStack.$loaded++;
			progressStack[path] = 'load';
			settings.update(progressStack, notification);
			settings.render(notification);
			return;
		},
		transform: (code, id) => {
			if (!settings.filter(id)) return; // Ignore meta files
			var path = fspath.relative(settings.baseDir, id);
			progressStack.$transformed++;
			progressStack[path] = 'transform';
			settings.update(progressStack, notification);
			settings.render(notification);
			return;
		},
	};
};
