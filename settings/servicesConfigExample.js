module.exports.healthCheckEndpoint = '/';
module.exports.debugMode = true;
module.exports.intervalTime = 0.1;
module.exports.debugIntervalTime = 0.1;
module.exports.retry = {
    retries: 2,
    factor: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
    randomize: true,
};

var alertGroup = {
    missionCriticalAlertInfo : [
        {
            name:'Connor',
            number:'314-555-5555'
        }
    ],
    groupOneAlertInfo : [
        {
            name:'Bob',
            number:'314-555-5555',
            email:'bob@test.com',
            iftttUrl:'https://maker.ifttt.com/trigger/ifttt_triger_name_here/with/key/lkasjdf09ajsdf23'
        },
        {
            name:'This will fail (needs number, iftttUrl, or email)'
        }
    ]
};

module.exports.alertGroup = alertGroup;
const accessToken = "aksjdfkaljsd0ifja0sdfj";


//Services info ip port name etc..
var ServerOneIp = 'https://duckduckgo.com';
module.exports.services = [
    {
        name:'DDG',
        server:'DuckDuckGo',
        ip: ServerOneIp,
        port:'80',
        alertInfo:alertGroup.missionCriticalAlertInfo,
        route:'/healthCheck',
        dependantServices:[
            {
                name:'sensor1',
                server:'Photon',
                ip:ServerOneIp,
                port:'200',
                alertInfo:alertGroup.missionCriticalAlertInfo,
                route:'/'
            },
            {
                name:'sensor2',
                server:'Photon',
                ip:serverInternetIp,
                port:'300',
                alertInfo:alertGroup.missionCriticalAlertInfo,
                route:'/'
            }
        ]
    },
    {
        name:'Simple banking',
        server:'Simple',
        ip:"https://simple.com",
        port:'80',
        alertInfo:alertGroup.missionCriticalAlertInfo
    },
    {
        name:'Betterment',
        server:'Betterment server',
        ip:"https://betterment.com",
        port:'80',
        alertInfo:alertGroup.groupOneAlertInfo
    }
];
