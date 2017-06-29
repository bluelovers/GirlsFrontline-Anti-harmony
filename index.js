/**
 * Created by user.
 */

'use strict';

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

const DEBUG2 = 1;

try
{
	dummy()
		.catch(_error_trace)
	;
}
catch (e)
{
	_error_trace(e);
}

async function dummy()
{
	console.log(`搜尋裝置清單`);

	let devices = await client.listDevices();

	if (!devices.length)
	{
		console.error(`Error: 找不到裝置列表，請檢查是否已連接可執行 ADB 的裝置`);

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

		console.log(`[${device.id}] 檢測 APP`);

		let app_any = false;

		//console.info(JSON.stringify(apps, null, "\t"));
		Object.keys(apps)
			.reduce((a, app) =>
			{

				console.info(`\t`, apps[app] ? '已' : '未', '安裝', `\t${app}`, );

				if (apps[app] )
				{
					app_any = true;
				}

			}, {})
		;

		if (!app_any)
		{
			console.error(`[${device.id}] Error: 找不到任何符合的 APP ( 未安裝 或 權限遭封鎖 )`);

			continue;
		}

		for (let app in apps)
		{
			if (!apps[app])
			{
				console.info(`[${device.id}] 找不到 ${app}`);

				continue;
			}

			let pull_file = `/data/data/${app}/shared_prefs/${app}.xml`;
			let push_file = pull_file + (DEBUG ? '.new' : '');

			let buf = await adb_helper.readFileBuffer(pull_file, device, client);

			if (!buf || !buf.size())
			{
				console.error(`[${device.id}] Error: 找不到 ${pull_file}`);

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
				console.info(`[${device.id}] 變更 ${app} 設定`);

				elem.attr('value', 1);

				let file = _tmp_file(device.id, pull_file, 'new');

				fs.writeFileSync(file, $.xml());

				console.log(`[${device.id}] 開始推送 ${push_file}`);

				await client.push(device.id, file, push_file + (DEBUG ? 'new' : ''));

				console.log(`[${device.id}] 已成功推送 ${push_file}`);

				console.log(`[${device.id}] 刪除暫存檔案 \`${file}\``);

				!DEBUG && fs.unlinkSync(file);
			}
			else
			{
				console.info(`[${device.id}] 略過 ${app} 不需要修改`);
			}
		}
	}

	console.info(`已結束所有裝置的處理步驟`);
}

function _error_trace(e)
{
	console.error(e, e.stack);
	console.trace(e);
}

function _tmp_file(...argv)
{
	argv.push(Date.now().toString());

	return path.join(TEMP, argv.map((v) =>
	{
		return path.basename(v).trim();
	}).join('.').replace(/[\s\:\*\?\|\"\']+/g, '_'));
}
