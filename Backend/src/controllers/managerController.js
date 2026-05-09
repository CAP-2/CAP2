const dashboardController = require('./managerController/dashboardController');
const memberController = require('./managerController/memberController');
const moderationController = require('./managerController/moderationController');
const eventTaskController = require('./managerController/eventTaskController');
const treeController = require('./managerController/treeController');

module.exports = {
    ...dashboardController,
    ...memberController,
    ...moderationController,
    ...eventTaskController,
    ...treeController,
};
