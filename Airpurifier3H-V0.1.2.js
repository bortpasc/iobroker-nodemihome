const SkriptVersion = "0.1.0"; //Link zu Git: https://github.com/Pittini/iobroker-nodemihome / Forum:

const mihome = require('node-mihome');

const username = '';
const password = '';
const options = { country: 'de' }; // 'ru', 'us', 'tw', 'sg', 'cn', 'de' (Default: 'cn')
const refresh = 10000;

const praefix0 = "javascript.0.MiHome.AirPurifier3H.";
const praefix1 = "javascript.0.MiHome.AllYourMiDevices.";

const logging = true;

//Ab hier nix mehr ändern!
const DeviceData = [];

let device;

const States = [];
let DpCount = 0;
let TriggerLock = true;
log("Starting Airpurifier3H-V" + SkriptVersion);

const DeviceGets = ["Power", "Mode", "FanLevel", "Buzzer", "LcdBrightness", "Temperature", "Humidity", "PM2_5", "FilterRemaining"]
const DeviceSets = ["Power", "Mode", "FanLevel", "Buzzer", "LcdBrightness", "ChildLock"]

//DeviceDps
States[DpCount] = { id: praefix0 + "Power", initial: false, forceCreation: false, common: { read: true, write: true, name: "Power", type: "boolean", role: "switch.power", def: false } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Mode", initial: "", forceCreation: false, common: { read: true, write: true, name: "Mode", type: "string", role: "value", states: { "none": "=Fanlevel", "auto": "auto", "sleep": "sleep", "favorite": "favorite" }, def: "" } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "FanLevel", initial: 1, forceCreation: false, common: { read: true, write: true, name: "FanLevel", type: "number", role: "level.fan", def: 1, min: 1, max: 3 } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Temperature", initial: 0, forceCreation: false, common: { read: true, write: false, name: "Temperature", type: "number", unit: "°C", role: "value.temperature", def: 0 } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Humidity", initial: 0, forceCreation: false, common: { read: true, write: false, name: "Humidity", type: "number", unit: "%", role: "value.humidity", def: 0 } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "PM2_5", initial: 0, forceCreation: false, common: { read: true, write: false, name: "PM 2.5", type: "number", unit: "", role: "value", def: 0 } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "FilterRemaining", initial: 0, forceCreation: false, common: { read: true, write: false, name: "Filter Remaining", type: "number", unit: "days", role: "value", def: 0 } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Buzzer", initial: false, forceCreation: false, common: { read: true, write: true, name: "Buzzer", type: "boolean", role: "switch", def: false } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "LcdBrightness", initial: 1, forceCreation: false, common: { read: true, write: true, name: "LcdBrightness", type: "number", role: "level.brightness", def: 1, min: 0, max: 2 } }; // 0-brightest, 1-glimmer, 2-led_closed
DpCount++;
States[DpCount] = { id: praefix0 + "ChildLock", initial: false, forceCreation: false, common: { read: true, write: true, name: "ChildLock", type: "boolean", role: "switch", def: false } }; //

//StaticDps
DpCount++;
States[DpCount] = { id: praefix0 + "Info.IpAdress", initial: "", forceCreation: false, common: { read: true, write: true, name: "Ip Adress", type: "string", role: "value",  def: "" } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Info.Token", initial: "", forceCreation: false, common: { read: true, write: true, name: "Token", type: "string", role: "value",  def: "" } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Info.DeviceId", initial: "", forceCreation: false, common: { read: true, write: true, name: "Device Id", type: "string", role: "value",  def: "" } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Info.Model", initial: "", forceCreation: false, common: { read: true, write: true, name: "Model", type: "string", role: "value",  def: "" } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Info.Rssi", initial: 0, forceCreation: false, common: { read: true, write: false, name: "rssi", type: "number",  role: "value.rssi", def: 0 } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Info.Name", initial: "", forceCreation: false, common: { read: true, write: true, name: "Name", type: "string", role: "value",  def: "" } }; //
DpCount++;
States[DpCount] = { id: praefix0 + "Info.IsOnline", initial: false, forceCreation: false, common: { read: true, write: true, name: "Is online", type: "boolean", role: "value", def: false } }; //


//Alle States anlegen, Main aufrufen wenn fertig
let numStates = States.length;
States.forEach(function (state) {
    createState(state.id, state.initial, state.forceCreation, state.common, function () {
        numStates--;
        if (numStates === 0) {
            if (logging) log("CreateStates fertig!");
            main();
        };
    });
});

function main() {
    if (logging) log("Reaching main");
    CreateDpTrigger();
    Init();
}

async function Init() { //Cloudlogin und auslesen der gesamten Clouddaten
    if (logging) log("Reaching init");

    // local miIO
    mihome.miioProtocol.init();

    try {// cloud MIoT
        await mihome.miCloudProtocol.login(username, password);
    }
    catch {
        log("You are already logged in, login canceled");
    }

    let AllDevicesRaw = await mihome.miCloudProtocol.getDevices(null, options); //Gibt alle vorhandenen Devices zurück
    //if (logging) console.warn(await mihome.miCloudProtocol.getDevice([317335021], options)); // get devices information from list ids

    for (let x = 0; x < AllDevicesRaw.length; x++) {
        if (AllDevicesRaw[x].model == "zhimi.airpurifier.mb3") {
            setState(praefix0 + "Info.IpAdress", AllDevicesRaw[x].localip);
            setState(praefix0 + "Info.Token", AllDevicesRaw[x].token);
            setState(praefix0 + "Info.DeviceId", AllDevicesRaw[x].did);
            setState(praefix0 + "Info.Model", AllDevicesRaw[x].model);
            setState(praefix0 + "Info.Rssi", AllDevicesRaw[x].rssi);
            setState(praefix0 + "Info.Name", AllDevicesRaw[x].name);
            setState(praefix0 + "Info.IsOnline", AllDevicesRaw[x].isOnline);
            log(AllDevicesRaw[x])
            Create_device(AllDevicesRaw[x].did, AllDevicesRaw[x].model, AllDevicesRaw[x].localip, AllDevicesRaw[x].token);
            return;
        };
    };
}


async function Create_device(did, model, adress, token) {
    if (logging) log("Reaching CreateDevice did=" + did + " model=" + model + " adress=" + adress + " token=" + token);

    device = mihome.device({
        id: did, // required, device id
        model: model, // required, device model "zhimi.airpurifier.mb3"
        address: adress, // miio-device option, local ip address
        token: token, // miio-device option, device token 4ff8a96292d0451c5148142a0a851e4f
        refresh: 10000 // miio-device option, device properties refresh interval in ms
    });

    device.on('properties', (data) => {
        device.Power = device.getPower(); // liefert ein bestimmtes Attribut
        device.Mode = device.getMode(); // liefert ein bestimmtes Attribut - auto/sleep/none
        device.FanLevel = device.getFanLevel(); // liefert ein bestimmtes Attribut
        device.Temperature = device.getTemperature(); // liefert ein bestimmtes Attribut
        device.Humidity = device.getHumidity(); // liefert ein bestimmtes Attribut
        device.PM2_5 = device.getPM2_5(); // liefert ein bestimmtes Attribut
        device.FilterRemaining = device.getFilterRemaining(); // liefert ein bestimmtes Attribut
        device.Buzzer = device.getBuzzer(); // liefert ein bestimmtes Attribut
        device.LcdBrightness = device.getLcdBrightness(); // liefert ein bestimmtes Attribut

        RefreshDps();
    });

    await device.init(); // connect to device and poll for properties
    //await device.setFanLevel(0); // call the method
    //await device.setMode(1); // call the method

    onStop(function () { //Bei Scriptende Device löschen
        device.destroy();
        unsubscribe('properties');
    }, 10);
}

function RefreshDps() {
    if (logging) log("Reaching RefreshDps ");
    TriggerLock = true;

    if (device.Power != DeviceData[0]) {
        DeviceData[0] = device.Power;
        setState(praefix0 + DeviceGets[0], DeviceData[0]);
    }
    if (device.Mode != DeviceData[1]) {
        DeviceData[1] = device.Mode;
        setState(praefix0 + DeviceGets[1], DeviceData[1]);
    }
    if (device.FanLevel != DeviceData[2]) {
        DeviceData[2] = device.FanLevel;
        setState(praefix0 + DeviceGets[2], DeviceData[2]);
    }
    if (device.Buzzer != DeviceData[3]) {
        DeviceData[3] = device.Buzzer;
        setState(praefix0 + DeviceGets[3], DeviceData[3]);
    }
    if (device.LcdBrightness != DeviceData[4]) {
        DeviceData[4] = device.LcdBrightness;
        setState(praefix0 + DeviceGets[4], DeviceData[4]);
    }

    if (device.Temperature != DeviceData[5]) {
        DeviceData[5] = device.Temperature;
        setState(praefix0 + DeviceGets[5], DeviceData[5]);
    }
    if (device.Humidity != DeviceData[6]) {
        DeviceData[6] = device.Humidity;
        setState(praefix0 + DeviceGets[6], DeviceData[6]);
    }
    if (device.PM2_5 != DeviceData[7]) {
        DeviceData[7] = device.PM2_5;
        setState(praefix0 + DeviceGets[7], DeviceData[7]);
    }
    if (device.FilterRemaining != DeviceData[8]) {
        DeviceData[8] = device.FilterRemaining;
        setState(praefix0 + DeviceGets[8], DeviceData[8]);
    }
    TriggerLock = false;

    log(DeviceData)


}

async function SetDevice(x, data) {
    if (logging) log("Reaching SetDevice x=" + x + " data=" + data);
    DeviceData[x] = data;
    //await device.init(); // connect to device and poll for properties
    switch (x) {
        case 0:
            log(await device.setPower(data));
            break;
        case 1:
            log(await device.setMode(2));
            break;
        case 2:
            log(await device.setFanLevel(data));
            break;
        case 3:
            log(await device.setBuzzer(data));
            break;
        case 4:
            log(device.setLcdBrightness(data));
            break;
        case 5:
            log(await device.setChildLock(data));
            break;
        default:

    }

}


function CreateDpTrigger() {
    if (logging) log("Reaching CreateDpTrigger");

    for (let x = 0; x < DeviceSets.length; x++) {
        on(praefix0 + DeviceSets[x], function (dp) { //Bei Statusänderung
            log("Triggered x=" + x + " Triggerlock=" + TriggerLock)
            if (TriggerLock) {
                TriggerLock = false;
                log("Refresh write, triggering canceled");
            } else {
                log("Wonna write now");
                SetDevice(x, dp.state.val);
            };
        });
    };
}







