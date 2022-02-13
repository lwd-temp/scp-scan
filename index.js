const got = require('got');
const cheerio = require('cheerio');
const winston = require('winston');
const WD = require('./wikidot.js');
var wd = new WD('scp-wiki-cn');

const logFormat = winston.format(info => {
    info.level = info.level.toUpperCase();
    if (info.stack) {
        info.message = `${info.message}\n${info.stack}`;
    }
    return info;
});
winston.add(new winston.transports.Console({
    format: winston.format.combine(
        logFormat(),
        winston.format.colorize(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)
    ),
}));


process.on('unhandledRejection', (reason, promise) => {
    promise.catch(e => {
        winston.error('Unhandled Rejection: ', e);
    });
});

process.on('uncaughtException', (err, origin) => {
    winston.error(`Uncaught exception:`, err);
});

process.on('rejectionHandled', promise => {
    // 忽略
});

winston.level = 'info';

const getInfo = async (params) => {
    let ans = [];
    let res = await wd.listPages(Object.assign({
      category: "-admin -system -archived -author -ci -credit -deleted -forum -nav -old -poll -protected -random -ratemod -search -template",
      order: "created_at desc desc",
      perPage: "250",
      separate: "false",
      module_body: `[[head]]
      [[table class="wiki-content-table"]]
      [[/head]]
      [[body]]
      [[row]]
      [[cell]]
      %%fullname%%
      [[/cell]]
      [[cell]]
      %%title%%
      [[/cell]]
      [[/row]]
      [[/body]]
      [[foot]]
      [[/table]]
      [[/foot]]`
    }, params));
    let $ = cheerio.load(res.body);
    let pages = $('table').find('tr');
    for(let i=0; i<pages.length; i++){
        let page = $(pages[i]).children('td');
        ans.push({
            fullname: $(page[0]).text().trim(),
            title: $(page[1]).text().trim(),
        });
    }
    return ans;
}

(async()=>{
    await wd.login('username','password');
    winston.info(`Logined`)
    let pages=await getInfo();
    winston.info(`Got pages ${pages.length}`);
    for(let i=0; i<pages.length; i++){
        let source = await wd.source(pages[i].fullname);
        source = source.body.replace(/^\s*\<h1\>.*\<\/h1\>\s*<div class\=\"page\-source\"\>\s*/,'')
                            .replace(/\s*\<\/div\>\s*$/, '')
                            .replace(/\<\/?a(\s[a-z]+\=\".*\")*\>/g,'')
                            .replace(/\&amp\;/g,'&')
                            .replace(/\&lt\;/g,'<')
                            .replace(/\&gt\;/g,'>')
                            .replace(/\&quot\;/g,'"')
                            .replace(/\&nbsp\;/g,' ')
                            .replace(/\<br(\s+\/)?\>/g, '');
        // console.log(source)
        winston.info(`Got (${i})[${pages[i].fullname}] source`);
        source = source.replace(/https?\:\/\/(www\.)?(scp\-wiki\.net|scp\-wiki\.wikidot\.com)/gi, 'https://scp-wiki.wikidot.com')
                       .replace(/https?\:\/\/(www\.)?scp\-wiki\-cn\.wikidot\.com/gi, 'https://scp-wiki-cn.wikidot.com')
                       .replace(/\.wikidot\.com\/local\-\-/gi, '.wikidot.com/local--')
                       .replace(/\[\[\[https\:\/\/scp\-wikidot\-com\//gi, '[[[');
        try{
            await wd.edit(pages[i].fullname,{
                title: pages[i].title,
                source: source,
                comments: `Edited by github.com/yuuki410/scp-scan; 若有不當之處請回退`,
            });
        } catch(e) {
            winston.warn(`Edit ${pages[i].title} failed: ${e}`);
        }
        await (new Promise((resolve)=>{ setTimeout(()=>{ resolve() }, 5*1000)}));
    }
})();