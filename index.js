"use strict";

/*
 * moment      - get unix timestamp
 * request     - use for request to api
 */
const moment = require('moment');
var request = require('request').defaults({
    json: true
});

/*
 * http sniffer function
 */
module.exports.logSniffer = function (proxy) {

    let apptag = proxy['apptag'] || "defaultBackend";
    let api = proxy['api'] || "http://localhost:4600/api/v3_5/httplog";
    return function *logSniffer(next) {

        if (this.request.method == 'HEAD') {
            yield *next;
        } else {

            let err;
            try {
                yield *next;
            } catch (e) {
                err = e;
            } finally {
                let logMsg = {
                    apptag: apptag,
                    url: this.request.href,
                    method: this.request.method,
                    status: this.status,
                    request: this.request.body,
                    response: this.response.body,
                    ua: this.header['user-agent'],
                    eventTime: moment().valueOf(),
                };

                if (typeof this.header['remoteip'] != undefined) {
                    logMsg['ip'] = this.header['remoteip'];
                } else if (this.get('X-Forwarded-For') != '') {
                    let forwardedIpsStr = this.get('X-Forwarded-For');
                    let forwardedIp = forwardedIpsStr.split(',')[0];
                    logMsg['ip'] = forwardedIp;
                } else {
                    logMsg['ip'] = undefined;
                }

                if (this.header['authorization'] != undefined) {
                    logMsg['token'] = this.header['authorization'];
                } else {
                    logMsg['token'] = undefined;
                }

                try {

                    request({method:'POST', url: api, body: logMsg, headers: {"connection": "keep-alive"}}, function(error, response, body) {
                        if(error){
                            err = error;
                        }

                        if(response.statusCode >= 400){
                            var statusCodeError = new Error('sniffer failed with status code ' + response.statusCode);
                            statusCodeError.name = 'StatusCodeError';
                            statusCodeError.statusCode = response.statusCode;
                        }
                    });

                } catch (e) {
                    err = e;
                }

            }

            if (err) throw err;
        }
    };
};