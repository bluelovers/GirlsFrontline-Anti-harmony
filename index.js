/**
 * Created by user.
 */

const Promise = require('bluebird')
const fs = require('fs')
const adb = require('adbkit')
const client = adb.createClient()
const path = require('upath2')
const cheerio = require('cheerio')
const streamBuffers = require('stream-buffers');
//const stream = require('stream');

const TEMP = path.join((process.env.TMP || process.env.TEMP), '/');

const DEBUG = 0;

dummy();

async function dummy()
{
	'use strict';

	let pull_file = `/data/data/tw.txwy.and.snqx/shared_prefs/tw.txwy.and.snqx.xml`;
	let push_file = pull_file + (DEBUG ? '.new' : '');

	console.log(`Get all connected devices`);

	let devices = await client.listDevices();

	if (!devices.length)
	{
		console.error(`Error: Can't found devices`);

		return process.exit(1);
	}

	for (let device of devices)
	{
		let transfer = await client.pull(device.id, pull_file);

		let tp = new Promise(function (resolve, reject)
		{
			let buf = new streamBuffers.WritableStreamBuffer();

			transfer.on('end', function ()
			{
				resolve({
					id: device.id,
					pull_file: pull_file,
					tmp: buf
				})
			})
			transfer.on('error', reject)
			transfer.pipe(buf)
		});

		let data = await tp;

		if (!data.tmp.size())
		{
			console.error(`[${device.id}] Error: Can't found ${pull_file}`);

			continue;
		}

		let $ = cheerio.load(data.tmp.getContents(), {
			withDomLvl1: true,
			//normalizeWhitespace: false,
			xmlMode: true,
			//decodeEntities: true,
		});

		if ($('map int[name="Normal"]').attr('value') != 1 || DEBUG)
		{
			console.log(`[${device.id}] Set Config`);

			$('map int[name="Normal"]').attr('value', 1);

			let file = _tmp_file(device.id, pull_file, 'new');

			fs.writeFileSync(file, $.xml());

			console.log(`[${device.id}] Pushing ${push_file}`);

			await client.push(device.id, file, push_file);

			console.log(`[${device.id}] Pushed ${push_file}`);

			console.log(`[${device.id}] Delete cache file \`${file}\``);

			fs.unlinkSync(file);
		}
		else
		{
			console.info(`[${device.id}] Skip`);
		}
	}

	console.info(`Done from all connected devices`);

}

function _tmp_file(...argv)
{
	argv.push(Date.now().toString());

	return path.join(TEMP, argv.map((v) =>
	{
		return path.basename(v).trim();
	}).join('.').replace(/[\s\:\*\?\|\"\']+/g, '_'));
}
