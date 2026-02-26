#! /usr/bin/env node
var program = require('commander'),
    gs = require('../lib/generateStructure'),
    date = require('../lib/date');

let inquirer = require('inquirer');
let ui = new inquirer.ui.BottomBar();
const questions = [
    {
        type: "input",
        name: "name",
        message: "模块名称",
        default: '例如：login',
        format: function (input, answers) {
            console.log(input, answers);
        }
    },
    {
        type: "input",
        name: "description",
        message: "模块描述",
        default: "例如：登录模块"
    },
    {
        type: "input",
        name: "author",
        message: "开发者姓名",
        default: "例如：Veiss"
    },
    {
        type: 'confirm',
        message: '你是否确定。',
        name: 'cm'
    }
];

program
    .version(require('../package.json').version)
    .option('-init, --init', 'Init Modele')
    .usage('[options] [init]')
    .parse(process.argv);

program.parse(process.argv);

var pname = program.args[0];
if (!pname) {
    program.help();
} else if (pname != "init") {
    program.help();
} else {
    inquirer.prompt(questions).then(function (answers) {
        answers.date = date();
        console.log('正在拷贝文件，请稍等...')
        gs(answers);
    })
    
}

