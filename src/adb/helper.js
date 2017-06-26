/**
 * Created by user on 2017/6/26.
 */

'use strict';

const adb = require('adbkit');
const streamBuffers = require('stream-buffers');

module.exports = {

	_client(client = null)
	{
		if (client == null)
		{
			client = adb.createClient();
		}

		return client;
	},

	async appExists(appid, device, client = null, path = '/data/data')
	{
		client = module.exports._client(client);

		let ls = await client.readdir(device.id, path);

		if (Array.isArray(appid))
		{
			let data = appid.reduce((a, b) =>
			{
				a[b] = false;
				return a;
			}, {});

			for (let row of ls)
			{
				if (row.isDirectory() && appid.includes(row.name))
				{
					data[row.name] = true;
				}
			}

			return data;
		}
		else
		{
			for (let row of ls)
			{
				if (row.isDirectory() && appid == row.name)
				{
					return true;
				}
			}

			return false;
		}

		return null;
	},

	async readFileBuffer(file, device, client = null)
	{
		client = module.exports._client(client);

		let transfer = await client.pull(device.id, file);

		let tp = new Promise(function (resolve, reject)
		{
			let buf = new streamBuffers.WritableStreamBuffer();

			transfer.on('end', function ()
			{
				resolve(buf)
			})
			transfer.on('error', reject)
			transfer.pipe(buf)
		})
			.catch(() =>
			{
				return null;
			});

		return await tp;
	},

};
