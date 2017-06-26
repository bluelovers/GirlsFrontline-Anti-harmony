/**
 * Created by user.
 */

const Promise = require('bluebird');
const fs = require('fs');
const adb = require('adbkit');
const client = adb.createClient();
const path = require('upath2');
const cheerio = require('cheerio');
const streamBuffers = require('stream-buffers');
//const stream = require('stream');

const adb_helper = require('./src/adb/helper');

const TEMP = path.join((process.env.TMP || process.env.TEMP), '/');

const DEBUG = 0;

dummy();

async function dummy()
{
	'use strict';

	console.log(`Get all connected devices`);

	let devices = await client.listDevices();

	if (!devices.length)
	{
		console.error(`Error: Can't found devices`);

		return process.exit(1);
	}

	console.log(JSON.stringify(devices, null, "\t"));

	for (let device of devices)
	{
		let apps = await adb_helper.appExists([
			// google play
			'tw.txwy.and.snqx',
			// tw site apk
			'tw.txwy.andgw.snqx',
			// cn site apk
			'com.digitalsky.girlsfrontline.cn',
		], device, client);

		console.log(`[${device.id}] App installed (${Object.keys(apps).length})`);
		console.info(JSON.stringify(apps, null, "\t"));

		for (let app in apps)
		{
			if (!apps[app])
			{
				console.info(`[${device.id}] Can't found ${app}`);

				continue;
			}

			let pull_file = `/data/data/${app}/shared_prefs/${app}.xml`;
			let push_file = pull_file + (DEBUG ? '.new' : '');

			let buf = await adb_helper.readFileBuffer(pull_file, device, client);

			if (!buf || !buf.size())
			{
				console.error(`[${device.id}] Error: Can't found ${pull_file}`);

				buf = new streamBuffers.WritableStreamBuffer();

				buf.write(`<?xml version='1.0' encoding='utf-8' standalone='yes' ?><map></map>`);
			}

			let data = {
				id: device.id,
				pull_file: pull_file,
				tmp: buf,
			};

			let $ = cheerio.load(data.tmp.getContents(), {
				withDomLvl1: true,
				//normalizeWhitespace: false,
				xmlMode: true,
				//decodeEntities: true,
			});

			let elem = $('map int[name="Normal"]');

			if (!elem.length)
			{
				$('map').append(`<int name="Normal" value="0" />`);

				elem = $('map int[name="Normal"]');
			}

			if (DEBUG)
			{
				let file = _tmp_file(device.id, pull_file);
				fs.writeFileSync(file, $.xml());
			}

			if (elem.attr('value') != 1 || DEBUG)
			{
				console.info(`[${device.id}] Set Config ${app}`);

				elem.attr('value', 1);

				let file = _tmp_file(device.id, pull_file, 'new');

				fs.writeFileSync(file, $.xml());

				console.log(`[${device.id}] Pushing ${push_file}`);

				await client.push(device.id, file, push_file + (DEBUG ? 'new' : ''));

				console.log(`[${device.id}] Pushed ${push_file}`);

				console.log(`[${device.id}] Delete cache file \`${file}\``);

				!DEBUG && fs.unlinkSync(file);
			}
			else
			{
				console.info(`[${device.id}] Skip ${app}`);
			}
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
