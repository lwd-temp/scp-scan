本程序用於~~全自動~~ 人工智障式地按[HTTPS指導](scp-wiki-cn.wikidot.com/https-guide)替換掉非https鏈接。

代碼幾乎都抄襲了鑿海的[05-Bot](https://github.com/SCP-CN-Tech/05-Bot)，加了一點小修改，因爲05-Bot使用了MIT License所以不會有許可證兼容問題。

若編輯失敗會自動解除頁面編輯鎖定，以免影響別人編輯。

## 使用方法
在程序目錄下新建`config.json`並填寫：
```json
{
    'username': '你的用戶名',
    'password': '你的密碼'
}
```

然後運行程序……就這樣。