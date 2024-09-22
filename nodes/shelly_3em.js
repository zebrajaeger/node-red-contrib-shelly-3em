module.exports = function (RED) {
    function Shelly_3EM(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.name = config.name;
        node.url = config.url;
        node.intervalMs = parseInt(config.intervalMs);

        node.dayId = this.context().get('dayId');
        node.dayStartValues = node.context().get('dayStartValues');

        var timer = setInterval(() => {
            fetch(node.url).then(res => {
                if (!res.ok) {
                    node.error({ status: res.status, msgg: res.statusText });
                    return;
                }

                res.json().then(data => {
                    
                    const emeters = data.emeters;
                    const now = new Date();
                    var daySwitch = false;
                    const dayId = `${now.getFullYear()}_${now.getMonth()}_${now.getDay()}`;

                    // dayswitch
                    if (dayId !== node.dayId) {
                        node.dayId = dayId;
                        node.context().set('dayId', node.dayId);
                        
                        node.dayStartValues = { L1: emeters[0].total, L2: emeters[1].total, L3: emeters[2].total };
                        node.context().set('dayStartValues', node.dayStartValues);

                        daySwitch = true;
                    }
                    
                    const payload = {
                        dayId: node.dayId,
                        daySwitch,
                        L1: emeters[0],
                        L2: emeters[1],
                        L3: emeters[2],
                        total_power: data.total_power
                    }

                    // add day energy
                    payload.L1.total_day = emeters[0].total - node.dayStartValues.L1;
                    payload.L2.total_day = emeters[1].total - node.dayStartValues.L2;
                    payload.L3.total_day = emeters[2].total - node.dayStartValues.L3;
                    payload.total_day =  payload.L1.total_day + payload.L2.total_day + payload.L3.total_day;
                    
                    // console.log(payload)
                    node.send({ payload });
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

