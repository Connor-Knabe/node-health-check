// var request = require('request');
var nodemailer = require('nodemailer');
var express = require('express');
var twilio = require('twilio');
var loginInfo = require('./settings/loginInfo.js');
var config = require('./settings/servicesConfig.js');
var client = twilio(loginInfo.TWILIO_ACCOUNT_SID, loginInfo.TWILIO_AUTH_TOKEN);
var app = express();
var dns = require('dns');
var request = require('requestretry');


var services = config.services;
var alertGroup = config.alertGroup;
var retryAttempts = config.retryAttempts;

var port = process.env.PORT || 2615;
var router = express.Router();
app.listen(port);
console.log('Magic happens on port ' + port +' - '+ new Date());
app.get('/', function(req,res){
    res.send({'status':'200'});
});

checkForValidAlerts(alertGroup);
populateServicesObj();
var intervalTime = config.intervalTime;
if(config.debugMode){
	intervalTime = config.debugIntervalTime;
	retryAttempts = config.debugRetryAttempts;
	console.log('_____________________________\nIn debug mode will not send any alerts!!\n_____________________________');
}



setInterval(function(){
    for (var i=0;i<services.length;i++){
        var healthCheckEndPoint = services[i].route ? services[i].route : config.healthCheckEndpoint;
        var port = services[i].port ? ':'+services[i].port : '';
		checkServiceHealth(i,services[i].name,services[i].ip+port+healthCheckEndPoint);
    }
}, intervalTime*60*1000);



function serviceObjectFromName(serviceName){
    var found = services.filter(function(item) { return item.name === serviceName; });
    return found[0];
}

function sendMessage(alertInfo, msgContent){
    if(alertInfo) {
		for (var i = 0; i < alertInfo.length; i++) {
            if(alertInfo[i].email){
                sendEmail(alertInfo[i],msgContent);
            }
            if(alertInfo[i].number){
                sendText(alertInfo[i],msgContent);
            }
		}
	}
}

function sendText(alertInfo, msgContent){
    if(!config.debugMode){
        client.messages.create({
            to: alertInfo.number,
            from: loginInfo.twilioFromNumber,
            body: msgContent
        }, function(err, message) {
            if(err){
                console.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
            } else {
                console.log(new Date(),' Text sent: ', msgContent);
            }
        });
    } else {
        console.log('not sending text in debug mode',msgContent);
    }
}

function sendEmail(alertInfo, msgContent){
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: loginInfo.gmailUsername,
            pass: loginInfo.gmailPass
        }
    });
    var mailOptions = {
        from: loginInfo.gmailUsername,
        to: alertInfo.email,
        subject: 'Server down Alert!',
        text: msgContent
    };
    if(!config.debugMode){
        transporter.sendMail(mailOptions, function(error, info){
            if(error){
                return console.log(error);
            }
            console.log(new Date(),' Email sent: ', msgContent);
        });
    } else {
        console.log(new Date(), 'not sending email in debug mode', msgContent);
    }

}

function sendAlert(serviceObj, isOnline){
    var serviceName = serviceObj.name;
    var isServiceOnServerInternet = serviceObj.ip == config.serverInternetIp;
	var serverInternetObj = serviceObjectFromName(config.serverInternetName);
	var internetHealthServer = serviceName == config.serverInternetName;
	if(isServiceOnServerInternet && internetHealthServer){
		verifyOnlineAndSendMessage(serviceObj,serviceName,isOnline)
	} else if(isServiceOnServerInternet && !internetHealthServer && serverInternetObj.isOnline){
		verifyOnlineAndSendMessage(serviceObj,serviceName,isOnline)
	} else if(!isServiceOnServerInternet){
		verifyOnlineAndSendMessage(serviceObj,serviceName,isOnline)
	}            
}

function verifyOnlineAndSendMessage(serviceObj,serviceName, isOnline){
	if(isOnline && !serviceObj.needsToSend){
        sendMessage(serviceObj.alertInfo,serviceName+' is online!');
        serviceObj.needsToSend = true;
    } else if(!isOnline && serviceObj.needsToSend) {
        sendMessage(serviceObj.alertInfo,serviceName+' is offline!');
        serviceObj.needsToSend = false;
    }	
}

function myRetryStrategy(err, response, body){
  // retry the request if we had an error or if the response was a 'Bad Gateway'
  return err || response.statusCode === 502;
}


function checkServiceHealth(i,name,ip){
	var alertDelay = i<15 ? i*10*1000 : 3*60*1000;
	var serviceObj = serviceObjectFromName(name);
	request({
		timeout:3000,
	    url: ip,
		retryDelay: 1000,
	    json:true,
	    retryStrategy: myRetryStrategy,
		maxAttempts: retryAttempts	    
	})
	.then(function (response) {		
		if(response.attempts >= retryAttempts){
			console.log("Max attempts hit", new Date());
			serviceObj.isOnline = false;
			clearTimeout(serviceObj.maxTimeout);
			serviceObj.maxTimeout = setTimeout(function(){
				sendAlert(serviceObj,serviceObj.isOnline);
			}, alertDelay);
		} else {
			serviceObj.isOnline = true;
			clearTimeout(serviceObj.online);
			serviceObj.online = setTimeout(function(){
				sendAlert(serviceObj,serviceObj.isOnline);
			}, alertDelay);
		}

	})
	.catch(function(error) {
		console.error( new Date(),' Error making request',error);
        serviceObj.isOnline = false;
        clearTimeout(serviceObj.isOffline);
        serviceObj.isOffline = setTimeout(function(){
			sendAlert(serviceObj,serviceObj.isOnline);
		}, alertDelay);
	});
}

function populateServicesObj(){
    for (var i=0;i<services.length;i++){
        services[i].isOnline = true;
        services[i].needsToSend = true;
    }
}

function checkForValidAlerts(alertGroup){
    for (var key in alertGroup) {
        // skip loop if the property is from prototype
        if (!alertGroup.hasOwnProperty(key)) continue;
        var obj = alertGroup[key];
        for (var prop in obj) {
            // skip loop if the property is from prototype
            if(!obj.hasOwnProperty(prop)) continue;
            if(!obj[prop].number && !obj[prop].email){
                console.error('Need a number or email for alert group:', key, '\nFor user:', obj[prop]);
            }
        }
    }
}

