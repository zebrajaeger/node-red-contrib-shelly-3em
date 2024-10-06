module.exports = function (RED) {
    function Shelly_3EM(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.name = config.name;
        node.url = config.url;
        node.intervalMs = parseInt(config.intervalMs);

        node.dayId = this.context().get('dayId');
        node.dayStartValues = node.context().get('dayStartValues');

        node.hourId = this.context().get('hourId');
        node.hourStartValues = node.context().get('hourStartValues');

        node.minuteId = this.context().get('minuteId');
        node.minuteStartValues = node.context().get('minuteStartValues');

        var timer = setInterval(() => {
            fetch(node.url).then(res => {
                if (!res.ok) {
                    node.error({ status: res.status, msg: res.statusText });
                    return;
                }

                res.json().then(data => {

                    const emeters = data.emeters;
                    if (!emeters || emeters.length < 3) {
                        node.error("Unexpected emeters data", data);
                        return;
                    }

                    const now = new Date();

                    // day-switch
                    var daySwitch = false;
                    var dayPayload = undefined;
                    const dayId = `${now.getFullYear()}_${now.getMonth()}_${now.getDay()}`;
                    if (dayId !== node.dayId) {
                        node.dayId = dayId;
                        node.context().set('dayId', node.dayId);

                        if (node.dayStartValues) {
                            const previousDay = new Date(now);
                            previousDay.setDate(now.getDate() - 1);
                            previousDay.setHours(0, 0, 0, 0);

                            dayPayload = {
                                date: previousDay.toISOString().split('T')[0],
                                L1: emeters[0].total - node.dayStartValues.L1,
                                L2: emeters[1].total - node.dayStartValues.L2,
                                L3: emeters[2].total - node.dayStartValues.L3
                            }
                        }

                        node.dayStartValues = { L1: emeters[0].total, L2: emeters[1].total, L3: emeters[2].total };
                        node.context().set('dayStartValues', node.dayStartValues);

                        daySwitch = true;
                    }

                    // hour-switch
                    var hourSwitch = false;
                    const hourId = `${now.getFullYear()}_${now.getMonth()}_${now.getDay()}_${now.getHours()}`;
                    var hourPayload = undefined;
                    if (hourId !== node.hourId) {
                        node.hourId = hourId;
                        node.context().set('hourId', node.hourId);

                        if (node.hourStartValues) {
                            const previousHour = new Date(now);
                            previousHour.setHours(now.getHours() - 1);
                            previousHour.setMinutes(0, 0);

                            hourPayload = {
                                date: previousHour.toISOString().split('.')[0],
                                L1: emeters[0].total - node.hourStartValues.L1,
                                L2: emeters[1].total - node.hourStartValues.L2,
                                L3: emeters[2].total - node.hourStartValues.L3
                            }
                        }

                        node.hourStartValues = { L1: emeters[0].total, L2: emeters[1].total, L3: emeters[2].total };
                        node.context().set('hourStartValues', node.hourStartValues);

                        hourSwitch = true;
                    }

                    // minute-switch
                    var minuteSwitch = false;
                    const minuteId = `${now.getFullYear()}_${now.getMonth()}_${now.getDay()}_${now.getHours()}_${now.getMinutes()}`;
                    var minutePayload = undefined;
                    if (minuteId !== node.minuteId) {
                        node.minuteId = minuteId;
                        node.context().set('minuteId', node.minuteId);

                        if (node.minuteStartValues) {
                            const previousMinute = new Date(now);
                            previousMinute.setMinutes(now.getMinutes() - 1);
                            previousMinute.setSeconds(0);

                            minutePayload = {
                                date: previousMinute.toISOString().split('.')[0],
                                L1: emeters[0].total - node.minuteStartValues.L1,
                                L2: emeters[1].total - node.minuteStartValues.L2,
                                L3: emeters[2].total - node.minuteStartValues.L3
                            }
                        }

                        node.minuteStartValues = { L1: emeters[0].total, L2: emeters[1].total, L3: emeters[2].total };
                        node.context().set('minuteStartValues', node.minuteStartValues);

                        minuteSwitch = true;
                    }

                    // every second - continuous values
                    const continousPayload = {
                        dayId: node.dayId,
                        daySwitch,
                        L1: emeters[0],
                        L2: emeters[1],
                        L3: emeters[2],
                        total_power: data.total_power
                    }

                    // add day energy
                    continousPayload.L1.total_day = emeters[0].total - node.dayStartValues.L1;
                    continousPayload.L2.total_day = emeters[1].total - node.dayStartValues.L2;
                    continousPayload.L3.total_day = emeters[2].total - node.dayStartValues.L3;
                    continousPayload.total_day = continousPayload.L1.total_day
                        + continousPayload.L2.total_day
                        + continousPayload.L3.total_day;

                    // console.log(payload)
                    node.send([
                        { payload: continousPayload },
                        dayPayload ? { payload: dayPayload } : null,
                        hourPayload ? { payload: hourPayload } : null,
                        minutePayload ? { payload: minutePayload } : null
                    ]);
                })

            }).catch(e => {
                node.error(e);
            })
        }, node.intervalMs);

        this.on('close', function () {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }
        });
    }

    RED.nodes.registerType("Shelly_3EM", Shelly_3EM);
}
