const { DateTime } = require("./luxon.js");

function isEmpty(value) {
    return (value == null || (typeof value === "string" && value.trim().length === 0));
}

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

                return res.json();
            }).then(data => {
                if (!data) {
                    node.error('No data');
                    return;
                }

                // Get emeter data
                const emeters = data.emeters;
                if (!emeters || emeters.length < 3) {
                    node.error("Unexpected emeters data", data);
                    return;
                }

                // Get time with or without timezone
                const now = isEmpty(node.zone) ? DateTime.now() : DateTime.now().setZone(node.zone);
                const dayPayload = makeDayPaload(now, emeters);
                const hourPayload = makeHourPayload(now, emeters);
                const minutePayload = makeMinutePayload(now, emeters);
                const continousPayload = makeContinousPayload(now, emeters, data);

                // console.log(payload)
                node.send([
                    { payload: continousPayload },
                    dayPayload ? { payload: dayPayload } : null,
                    hourPayload ? { payload: hourPayload } : null,
                    minutePayload ? { payload: minutePayload } : null
                ]);

            }).catch(e => {
                node.error("Failed", e);
            })
        }, node.intervalMs);

        this.on('close', function () {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }
        });

        function makeContinousPayload(now, emeters, data) {
            const continousPayload = {
                date: now.toISO(),
                dayId: node.dayId,
                L1: emeters[0],
                L2: emeters[1],
                L3: emeters[2],
                total_power: data.total_power
            };

            // add day energy
            continousPayload.L1.total_day = emeters[0].total - node.dayStartValues.L1;
            continousPayload.L2.total_day = emeters[1].total - node.dayStartValues.L2;
            continousPayload.L3.total_day = emeters[2].total - node.dayStartValues.L3;
            continousPayload.total_day = continousPayload.L1.total_day
                + continousPayload.L2.total_day
                + continousPayload.L3.total_day;
            return continousPayload;
        }

        function makeDayPaload(now, emeters) {
            var dayPayload = undefined;
            const dayId = now.startOf('day').toISO();
            if (dayId !== node.dayId) {
                node.dayId = dayId;
                node.context().set('dayId', node.dayId);

                if (node.dayStartValues) {
                    dayPayload = {
                        date: now.minus({ days: 1 }).startOf('day').toISO(),
                        L1: emeters[0].total - node.dayStartValues.L1,
                        L2: emeters[1].total - node.dayStartValues.L2,
                        L3: emeters[2].total - node.dayStartValues.L3
                    };
                }

                node.dayStartValues = { L1: emeters[0].total, L2: emeters[1].total, L3: emeters[2].total };
                node.context().set('dayStartValues', node.dayStartValues);
            }
            return dayPayload;
        }
        
        function makeHourPayload(now, emeters) {
            const hourId = now.startOf('hour').toISO();
            var hourPayload = undefined;
            if (hourId !== node.hourId) {
                node.hourId = hourId;
                node.context().set('hourId', node.hourId);

                if (node.hourStartValues) {
                    hourPayload = {
                        date: now.minus({ hours: 1 }).startOf('hour').toISO(),
                        L1: emeters[0].total - node.hourStartValues.L1,
                        L2: emeters[1].total - node.hourStartValues.L2,
                        L3: emeters[2].total - node.hourStartValues.L3
                    };
                }

                node.hourStartValues = { L1: emeters[0].total, L2: emeters[1].total, L3: emeters[2].total };
                node.context().set('hourStartValues', node.hourStartValues);
            }
            return hourPayload;
        }

        function makeMinutePayload(now, emeters) {
            const minuteId = now.startOf('minute').toISO();
            var minutePayload = undefined;
            if (minuteId !== node.minuteId) {
                node.minuteId = minuteId;
                node.context().set('minuteId', node.minuteId);

                if (node.minuteStartValues) {
                    minutePayload = {
                        date: now.minus({ minutes: 1 }).startOf('minute').toISO(),
                        L1: emeters[0].total - node.minuteStartValues.L1,
                        L2: emeters[1].total - node.minuteStartValues.L2,
                        L3: emeters[2].total - node.minuteStartValues.L3
                    };
                }

                node.minuteStartValues = { L1: emeters[0].total, L2: emeters[1].total, L3: emeters[2].total };
                node.context().set('minuteStartValues', node.minuteStartValues);
            }
            return minutePayload;
        }
    }

    RED.nodes.registerType("Shelly_3EM", Shelly_3EM);
}
