// Copied from <https://github.com/SCP-CN-Tech/05-Bot/blob/master/wikidot.js>

const got = require('got');
const cheerio = require('cheerio');
const winston = require('winston');
class WD {
  constructor(base) {
    this.wiki(base);
    this.cookie = {
      auth: '',
      sess: '',
      expire: null,
      exp: null
    };
  }
  wiki(base) {
    this.domain = base;
    if (!base.startsWith("http")) { base = `http://${base}.wikidot.com` }
    this.base = base;
    this.ajax = `${base}/ajax-module-connector.php`;
    this.quic = `${base}/quickmodule.php`;
    winston.debug(`Rebased to ${base}.`)
    return this;
  }
  setCookies(v) { Object.assign(this.cookie, v) }

  async req(params) {
    const wikidotToken7 = Math.random().toString(36).substring(4);
    let triedTimes = 0;
    let ret={
        'status': 'try_again',
        'time_to_wait': 0,
    };
    while(ret.status=='try_again'){
        if(triedTimes<5 && ret.time_to_wait){
            winston.warn(`Ajax module failed, waiting for ${ret.time_to_wait} second(s) then tring ${triedTimes} time(s)...`);
            await (new Promise((resolve)=>{ setTimeout(()=>{ resolve() }, ret.time_to_wait*1000)}));
        } else if(triedTimes==5){
            winston.error(`Ajax module failed 5 times.`);
            let e = new Error(ret.message);
            e.name = ret.status;
            throw e;
        } else if(triedTimes && !ret.time_to_wait){
            let e = new Error(ret.message);
            e.name = ret.status;
            throw e;
        }
        ret = await got.post(this.ajax, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            Referer: 'http://scp-wiki-cn.wikidot.com/',
            Cookie: `wikidot_token7=${wikidotToken7}; ${this.cookie.auth}`,
        },
        form: Object.assign({wikidot_token7: wikidotToken7, callbackIndex: 0}, params)
        }).json();
    }
    if (ret.status!=="ok") {
      let e = new Error(ret.message);
      e.name = ret.status;
      throw e;
    } else return ret;
  };

  async quick(module, params) {
    return await got.get(this.quic, {
      searchParams: Object.assign({module: module}, params)
    }).json();
  }

  async module(moduleName, params) {
    return await this.req(Object.assign({moduleName: moduleName}, params))
  }

  async action(action, params) {
    return await this.req(Object.assign({action: action, moduleName: "Empty"}, params))
  }

  async login(username, password) {
    const wikidotToken7 = Math.random().toString(36).substring(4);
    let res = await got.post('https://www.wikidot.com/default--flow/login__LoginPopupScreen', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        Referer: 'http://wikidot.com/',
        Cookie: `wikidot_token7=${wikidotToken7};`,
      },
      form: {
				login: username,
				password: password,
				action: 'Login2Action',
				event: 'login',
        wikidot_token7: wikidotToken7,
        callbackIndex: 0
			}
		})
    if (res.body.includes("The login and password do not match.")) {throw new Error("Wikidot login and password do not match.")}
    let tmp = res.headers['set-cookie'][1].split("; ")
  	this.cookie.sess = tmp[0]
  	this.cookie.expire = tmp[1].split("=")[1]
    this.cookie.exp = new Date(this.cookie.expire.split(",").pop().split("-").join(" "))
    this.cookie.auth = `${this.cookie.sess}; wikidot_udsession=1; `
    return this;
  }

  async getPageId(page) {
    let pg = await got.get(`${this.base}/${page}`).text()
  	pg = cheerio.load(pg)
  	let page_id = null;
  	pg(pg("head").children("script")
				.filter((i,el)=>pg(el).html().includes("WIKIREQUEST"))).html()
		    .replace(/WIKIREQUEST\.info\.pageId *?= *?(\d+);/g, (_, id)=>{
			page_id = id
		})
    return page_id;
  }

  async source(wiki_page) {
    let page_id = await this.getPageId(wiki_page);
  	return await this.module("viewsource/ViewSourceModule", {
  		page_id: page_id
  	})
  }

  async history(wiki_page, params) {
    let page_id = await this.getPageId(wiki_page);
  	return await this.module("history/PageRevisionListModule", Object.assign({
  		page_id: page_id,
      page: 1,
      perpage: 20,
      options: `{"all":true}`
  	}, params))
  }

  async edit(wiki_page, params) {
    var lock = await this.module('edit/PageEditModule', {
            mode: 'page',
            wiki_page: wiki_page,
            force_lock: true})
    return await this.action('WikiPageAction', Object.assign({
      event: 'savePage',
      wiki_page: wiki_page,
      lock_id: lock.lock_id,
      lock_secret: lock.lock_secret,
      revision_id: lock.page_revision_id||null,
    }, params))
  }

  async tags(wiki_page, params) {
    let page_id = await this.getPageId(wiki_page);
    let tags;
    if (typeof params === "string") {
      tags = params.split(" ");
    } else if (params instanceof Array) {
      tags = params;
    } else if (params instanceof Object) {
      tags = await this.module("pagetags/PageTagsModule", { pageId: page_id })
      tags = cheerio.load(tags.body)(`input[id="page-tags-input"]`).attr("value").split(" ")
      params.add = params.add instanceof Array ? params.add : (typeof params.add === "string" ? params.add.split(" ") : null)
      params.remove = params.remove instanceof Array ? params.remove : (typeof params.remove === "string" ? params.remove.split(" ") : null)
      tags = params.add ? tags.concat(params.add.filter(v=>!tags.includes(v))) : tags
      tags = params.remove ? tags.filter(v=>!params.remove.includes(v)) : tags
    }
    return await this.action('WikiPageAction', {
      event: 'saveTags',
      pageId: page_id,
      tags: tags.join(" "),
    })
  }

  async delete(wiki_page, params) {
    let page_id = await this.getPageId(wiki_page);
    return await this.action('WikiPageAction', Object.assign({
      event: 'deletePage',
      page_id: page_id,
    }, params))
  }

  async rename(wiki_page, new_name, params) {
    let page_id = await this.getPageId(wiki_page);
    return await this.action('WikiPageAction', Object.assign({
      event: 'renamePage',
      page_id: page_id,
      new_name: new_name,
    }, params))
  }

  async listPages(params) {
    return await this.module('list/ListPagesModule', Object.assign({
      category: "*",
      tags: "-管理",
      order: "created_at desc desc",
      perPage: "20",
      separate: "true",
      module_body: ``
    }, params));
  }
}
module.exports = WD;
