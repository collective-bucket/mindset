(function (root) {
  "use strict";

  var STORAGE_KEY = "mindset-lang";
  var LANGS = ["en", "tr"];

  var dict = {
    en: {
      "tab.home": "Home",
      "tab.explore": "Explore",
      "tab.create": "Create",
      "tab.tribe": "Tribe",
      "tab.me": "Me",
      "footer.project": "A Collective Bucket project",
      "footer.language": "Language",
      "top.signIn": "Sign in",

      "common.loading": "Loading",
      "common.saving": "Saving",
      "common.cancel": "Cancel",
      "common.unknown": "unclear",
      "common.notTest": "This is not a test result. It's an approximate reading.",
      "common.error": "Something went wrong.",
      "common.permission": "This can't be read right now.",
      "common.notFound": "Not found.",
      "common.mindset": "{n}. mindset",
      "common.preview": "Preview",
      "common.approx": "Approximate reading",
      "common.lastRead": "last read {date}",
      "common.needMindset": "Write your mindset first.",

      "home.title": "Your mindset as a number",
      "home.lead": "Write what you hold true and how you tell your story. Get a number like 212. Share it.",
      "home.private": "What you don't say out loud, your desire and your shadow stay with you.",
      "home.write": "Write yours",
      "home.explore": "Explore",
      "home.yours": "You are {link}.",
      "feed.latest": "Latest",
      "feed.following": "Following",
      "feed.tribe": "Tribe",
      "feed.empty": "Nothing here yet.",
      "feed.emptyFollowing": "Follow a few mindsets to fill this.",
      "feed.emptyTribe": "Your tribe is empty. Invite someone from their profile.",
      "feed.similar": "Similar to you",
      "feed.signInFor": "Sign in to see who you follow and your tribe.",

      "create.title": "Write",
      "create.edit": "Edit {n}. mindset",
      "create.lead": "The model downloads to your browser on first read. Your text isn't sent anywhere.",
      "create.openHint": "These three show on your profile. One line you hold true is enough to publish.",
      "create.closedTitle": "Stays with you",
      "create.closedHint": "What you don't say out loud, your desire and the side you're ashamed of go to no one. Their readings stay with you too.",
      "create.aboutTitle": "About you (optional)",
      "create.aboutHint": "Age range, gender and country show on your profile and shape lists and suggestions. City is never shown individually; it is only counted.",
      "create.read": "Read",
      "create.publish": "Publish",
      "create.reading": "Reading",
      "create.ready": "Approximate reading ready. Publish if you like.",
      "create.loaded": "Last reading loaded. Changing the text triggers a new read.",
      "create.privateTitle": "Only for you",
      "create.dialogOpen": "Right now, what you hold true and how you tell your story show on your profile. Your story may reveal you or someone else.",
      "create.dialogScale": "This is not a validated scale.",
      "create.publishWarning": "Mindset saved. The distribution couldn't be updated.",
      "create.signInToPublish": "Sign in to publish",

      "demo.age": "Age range",
      "demo.gender": "Gender",
      "demo.country": "Country",
      "demo.city": "City",
      "demo.cityHint": "Never shown individually.",
      "demo.none": "Prefer not to say",
      "gender.woman": "Woman",
      "gender.man": "Man",
      "gender.nonbinary": "Non-binary",
      "gender.other": "Other",

      "model.downloading": "Downloading model: {p}%",
      "model.preparing": "Preparing model",
      "model.reading": "Reading text",
      "model.ready": "Reading ready",

      "error.text_too_long": "{field} cannot exceed 1200 characters.",
      "error.code_required": "Write one line you hold true to publish.",
      "error.login_required": "Sign in to continue.",
      "error.read_failed": "Couldn't read.",
      "error.save_failed": "Couldn't save.",

      "profile.notPublished": "This mindset isn't published.",
      "profile.onlyYou": "Not published. Only you can see it.",
      "profile.follow": "Follow",
      "profile.following": "Following",
      "profile.addTribe": "Add to tribe",
      "profile.requested": "Requested",
      "profile.accept": "Accept into tribe",
      "profile.inTribe": "In your tribe",
      "profile.share": "Share",
      "profile.copied": "Link copied.",
      "profile.edit": "Edit",
      "profile.manage": "Manage",
      "profile.similar": "Similar mindsets",
      "profile.shareFailed": "Couldn't open sharing.",
      "profile.tribeNeedsMindset": "Publish your own mindset to build a tribe.",

      "explore.title": "Explore",
      "explore.axis": "Reading",
      "explore.newest": "Newest",
      "explore.min": "At least",
      "explore.slice": "Group",
      "explore.everyone": "Everyone",
      "explore.value": "Value",
      "explore.results": "Mindsets",
      "explore.empty": "No mindset matches this filter.",
      "explore.charts": "Distribution",
      "explore.noStats": "No distribution yet.",
      "explore.byAge": "By age",
      "explore.byGender": "By gender",
      "explore.byCountry": "Top countries",
      "explore.byCity": "Top cities",
      "explore.cityNote": "Cities with fewer than 5 people are hidden.",
      "explore.total": "{n} published",
      "explore.cantRead": "The list can't be read right now.",

      "tribe.title": "Tribe",
      "tribe.lead": "A tribe is mutual: you invite, they accept. Following needs no approval.",
      "tribe.incoming": "Requests",
      "tribe.outgoing": "Sent",
      "tribe.members": "Members",
      "tribe.accept": "Accept",
      "tribe.decline": "Decline",
      "tribe.cancel": "Cancel",
      "tribe.remove": "Remove",
      "tribe.none": "None.",
      "tribe.followingLink": "Following",

      "following.title": "Following",
      "following.lead": "Like bookmarks. Nobody is notified.",
      "following.unfollow": "Unfollow",

      "me.title": "Me",
      "me.signedInAs": "Signed in as {email}",
      "me.empty": "You don't have a mindset yet.",
      "me.published": "Published",
      "me.unpublished": "Not published",
      "me.unpublish": "Unpublish",
      "me.publish": "Publish",
      "me.view": "View profile",
      "me.edit": "Edit",
      "me.closedTexts": "Closed texts",
      "me.notWritten": "Not written",
      "me.aliasTitle": "Alias",
      "me.aliasHint": "Optional. 3-20 lowercase letters, digits or _. Your tribe always sees it.",
      "me.aliasPublic": "Everyone can see it",
      "me.aliasTribe": "Only my tribe",
      "me.aliasSave": "Save alias",
      "me.aliasRemove": "Remove alias",
      "me.aliasTaken": "This alias is taken.",
      "me.aliasInvalid": "Use 3-20 lowercase letters, digits or _.",
      "me.aliasSaved": "Alias saved.",
      "me.aliasRemoved": "Alias removed.",
      "me.aliasNeedsMindset": "Write a mindset to pick an alias.",
      "me.account": "Account",
      "me.signOut": "Sign out",
      "me.deleteMindset": "Delete mindset",
      "me.deleteMindsetCopy": "Delete {n}. mindset? Open and closed texts, readings, alias, tribe and following are deleted too.",
      "me.deleteAccount": "Delete account",
      "me.deleteAccountCopy": "Delete your account? This also removes your sign-in for other Collective Bucket apps. Your mindset is deleted first.",
      "me.recentLogin": "For safety, sign in again and retry.",
      "me.delete": "Delete",
      "me.deleting": "Deleting",

      "auth.loginTitle": "Sign in",
      "auth.registerTitle": "Create account",
      "auth.forgotTitle": "Reset password",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.passwordHint": "At least 6 characters.",
      "auth.adult": "I am 18 or older.",
      "auth.adultRequired": "You must be 18 or older.",
      "auth.submitLogin": "Sign in",
      "auth.submitRegister": "Create account",
      "auth.submitForgot": "Send reset link",
      "auth.google": "Continue with Google",
      "auth.or": "or",
      "auth.toRegister": "New here? Create an account",
      "auth.toLogin": "Have an account? Sign in",
      "auth.toForgot": "Forgot password?",
      "auth.resetSent": "If an account exists, a reset link is on its way.",
      "auth.shared": "Accounts are shared with Collective Bucket apps.",
      "auth.err.invalid": "Email or password is wrong.",
      "auth.err.exists": "This email already has an account.",
      "auth.err.weak": "Password is too weak.",
      "auth.err.email": "Enter a valid email.",
      "auth.err.popup": "The sign-in window was closed.",
      "auth.err.many": "Too many attempts. Try again later.",
      "auth.err.network": "Network error.",
      "auth.err.domain": "This domain isn't authorized for sign-in yet."
    },
    tr: {
      "tab.home": "Ana sayfa",
      "tab.explore": "Keşfet",
      "tab.create": "Yaz",
      "tab.tribe": "Kabile",
      "tab.me": "Ben",
      "footer.project": "Bir Collective Bucket projesi",
      "footer.language": "Dil",
      "top.signIn": "Giriş yap",

      "common.loading": "Yükleniyor",
      "common.saving": "Kaydediliyor",
      "common.cancel": "Vazgeç",
      "common.unknown": "belirsiz",
      "common.notTest": "Bu bir test sonucu değildir. Yaklaşık bir okumadır.",
      "common.error": "Bir şeyler ters gitti.",
      "common.permission": "Bu şu an okunamıyor.",
      "common.notFound": "Bulunamadı.",
      "common.mindset": "{n}. mindset",
      "common.preview": "Önizleme",
      "common.approx": "Yaklaşık okuma",
      "common.lastRead": "son okuma {date}",
      "common.needMindset": "Önce mindsetini yaz.",

      "home.title": "Mindsetin bir numara olsun",
      "home.lead": "Doğru bildiğini ve kendini nasıl anlattığını yaz. 212 gibi bir numara al. Paylaş.",
      "home.private": "Dışarıda söylemediğin, arzun ve gölgen sende kalır.",
      "home.write": "Seninkini yaz",
      "home.explore": "Keşfet",
      "home.yours": "Senin numaran {link}.",
      "feed.latest": "En yeni",
      "feed.following": "Takip",
      "feed.tribe": "Kabile",
      "feed.empty": "Burada henüz bir şey yok.",
      "feed.emptyFollowing": "Burayı doldurmak için birkaç mindset takip et.",
      "feed.emptyTribe": "Kabilen boş. Birini profilinden davet et.",
      "feed.similar": "Sana benzeyenler",
      "feed.signInFor": "Takip ettiklerini ve kabileni görmek için giriş yap.",

      "create.title": "Yaz",
      "create.edit": "{n}. mindseti düzenle",
      "create.lead": "İlk okumada model tarayıcına iner. Metin dışarı gönderilmez.",
      "create.openHint": "Bu üçü profilinde görünür. Yayınlamak için doğru bildiğin bir cümle yeter.",
      "create.closedTitle": "Yalnız sende kalır",
      "create.closedHint": "Dışarıda söylemediğin, arzu ve utandığın yan kimseye gitmez. Onların okuması da yalnız sende kalır.",
      "create.aboutTitle": "Hakkında (isteğe bağlı)",
      "create.aboutHint": "Yaş aralığı, cinsiyet ve ülke profilinde görünür; liste ve önerileri şekillendirir. Şehir tek tek gösterilmez, yalnızca sayılır.",
      "create.read": "Oku",
      "create.publish": "Yayınla",
      "create.reading": "Okunuyor",
      "create.ready": "Yaklaşık okuma hazır. İstersen yayınla.",
      "create.loaded": "Son okuma yüklendi. Metin değişirse yeniden okunur.",
      "create.privateTitle": "Yalnız sana",
      "create.dialogOpen": "Şu an, doğru bildiğin ve kendini nasıl anlattığın profilde görünür. Hikaye seni veya başkasını ele verebilir.",
      "create.dialogScale": "Bu bir ölçek değildir.",
      "create.publishWarning": "Mindset kaydedildi. Dağılım güncellenemedi.",
      "create.signInToPublish": "Yayınlamak için giriş yap",

      "demo.age": "Yaş aralığı",
      "demo.gender": "Cinsiyet",
      "demo.country": "Ülke",
      "demo.city": "Şehir",
      "demo.cityHint": "Tek tek gösterilmez.",
      "demo.none": "Belirtmek istemiyorum",
      "gender.woman": "Kadın",
      "gender.man": "Erkek",
      "gender.nonbinary": "İkili olmayan",
      "gender.other": "Diğer",

      "model.downloading": "Model indiriliyor: %{p}",
      "model.preparing": "Model hazırlanıyor",
      "model.reading": "Metin okunuyor",
      "model.ready": "Okuma hazır",

      "error.text_too_long": "{field} 1200 karakteri aşamaz.",
      "error.code_required": "Yayınlamak için doğru bildiğin bir cümle yaz.",
      "error.login_required": "Devam etmek için giriş yap.",
      "error.read_failed": "Okuma yapılamadı.",
      "error.save_failed": "Kaydedilemedi.",

      "profile.notPublished": "Bu mindset yayında değil.",
      "profile.onlyYou": "Yayında değil. Yalnız sen görürsün.",
      "profile.follow": "Takip et",
      "profile.following": "Takip ediliyor",
      "profile.addTribe": "Kabileme ekle",
      "profile.requested": "İstek gönderildi",
      "profile.accept": "Kabileye kabul et",
      "profile.inTribe": "Kabilende",
      "profile.share": "Paylaş",
      "profile.copied": "Link kopyalandı.",
      "profile.edit": "Düzenle",
      "profile.manage": "Yönet",
      "profile.similar": "Benzer mindsetler",
      "profile.shareFailed": "Paylaşım açılamadı.",
      "profile.tribeNeedsMindset": "Kabile kurmak için kendi mindsetini yayınla.",

      "explore.title": "Keşfet",
      "explore.axis": "Okuma",
      "explore.newest": "En yeni",
      "explore.min": "En az",
      "explore.slice": "Grup",
      "explore.everyone": "Herkes",
      "explore.value": "Değer",
      "explore.results": "Mindsetler",
      "explore.empty": "Bu süzgece uyan mindset yok.",
      "explore.charts": "Dağılım",
      "explore.noStats": "Henüz dağılım yok.",
      "explore.byAge": "Yaşa göre",
      "explore.byGender": "Cinsiyete göre",
      "explore.byCountry": "Ülkeler",
      "explore.byCity": "Şehirler",
      "explore.cityNote": "5 kişiden az olan şehirler gizli.",
      "explore.total": "{n} yayında",
      "explore.cantRead": "Liste şu an okunamıyor.",

      "tribe.title": "Kabile",
      "tribe.lead": "Kabile karşılıklıdır: sen davet edersin, o kabul eder. Takip onay istemez.",
      "tribe.incoming": "Gelen istekler",
      "tribe.outgoing": "Gönderilenler",
      "tribe.members": "Üyeler",
      "tribe.accept": "Kabul et",
      "tribe.decline": "Reddet",
      "tribe.cancel": "Geri çek",
      "tribe.remove": "Çıkar",
      "tribe.none": "Yok.",
      "tribe.followingLink": "Takip ettiklerin",

      "following.title": "Takip ettiklerin",
      "following.lead": "Yer imi gibi. Kimseye bildirilmez.",
      "following.unfollow": "Bırak",

      "me.title": "Ben",
      "me.signedInAs": "{email} olarak giriş yapıldı",
      "me.empty": "Henüz mindsetin yok.",
      "me.published": "Yayında",
      "me.unpublished": "Yayında değil",
      "me.unpublish": "Yayından kaldır",
      "me.publish": "Yayınla",
      "me.view": "Profili gör",
      "me.edit": "Düzenle",
      "me.closedTexts": "Kapalı metinler",
      "me.notWritten": "Yazılmamış",
      "me.aliasTitle": "Takma ad",
      "me.aliasHint": "İsteğe bağlı. 3-20 küçük harf, rakam ya da _. Kabilen her zaman görür.",
      "me.aliasPublic": "Herkes görsün",
      "me.aliasTribe": "Yalnız kabilem",
      "me.aliasSave": "Takma adı kaydet",
      "me.aliasRemove": "Takma adı kaldır",
      "me.aliasTaken": "Bu takma ad alınmış.",
      "me.aliasInvalid": "3-20 küçük harf, rakam ya da _ kullan.",
      "me.aliasSaved": "Takma ad kaydedildi.",
      "me.aliasRemoved": "Takma ad kaldırıldı.",
      "me.aliasNeedsMindset": "Takma ad seçmek için mindset yaz.",
      "me.account": "Hesap",
      "me.signOut": "Çıkış yap",
      "me.deleteMindset": "Mindseti sil",
      "me.deleteMindsetCopy": "{n}. mindset silinsin mi? Açık ve kapalı metinler, okumalar, takma ad, kabile ve takip de silinir.",
      "me.deleteAccount": "Hesabı sil",
      "me.deleteAccountCopy": "Hesabın silinsin mi? Diğer Collective Bucket uygulamalarındaki girişin de silinir. Önce mindsetin silinir.",
      "me.recentLogin": "Güvenlik için yeniden giriş yap ve tekrar dene.",
      "me.delete": "Sil",
      "me.deleting": "Siliniyor",

      "auth.loginTitle": "Giriş yap",
      "auth.registerTitle": "Hesap oluştur",
      "auth.forgotTitle": "Şifreyi sıfırla",
      "auth.email": "E-posta",
      "auth.password": "Şifre",
      "auth.passwordHint": "En az 6 karakter.",
      "auth.adult": "18 yaşından büyüğüm.",
      "auth.adultRequired": "18 yaşından büyük olmalısın.",
      "auth.submitLogin": "Giriş yap",
      "auth.submitRegister": "Hesap oluştur",
      "auth.submitForgot": "Sıfırlama linki gönder",
      "auth.google": "Google ile devam et",
      "auth.or": "ya da",
      "auth.toRegister": "Yeni misin? Hesap oluştur",
      "auth.toLogin": "Hesabın var mı? Giriş yap",
      "auth.toForgot": "Şifremi unuttum",
      "auth.resetSent": "Hesap varsa sıfırlama linki yolda.",
      "auth.shared": "Hesaplar Collective Bucket uygulamalarıyla ortaktır.",
      "auth.err.invalid": "E-posta ya da şifre yanlış.",
      "auth.err.exists": "Bu e-postanın zaten hesabı var.",
      "auth.err.weak": "Şifre çok zayıf.",
      "auth.err.email": "Geçerli bir e-posta gir.",
      "auth.err.popup": "Giriş penceresi kapandı.",
      "auth.err.many": "Çok fazla deneme. Sonra tekrar dene.",
      "auth.err.network": "Ağ hatası.",
      "auth.err.domain": "Bu alan adı giriş için henüz yetkili değil."
    }
  };

  function detect() {
    var stored = null;
    try {
      stored = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      stored = null;
    }
    if (LANGS.indexOf(stored) >= 0) return stored;
    var nav = (root.navigator && root.navigator.language) || "en";
    return /^tr\b/i.test(nav) ? "tr" : "en";
  }

  var lang = typeof window !== "undefined" ? detect() : "en";

  function t(key, vars) {
    var text = (dict[lang] && dict[lang][key]) || dict.en[key] || key;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, function (match, name) {
      return name in vars ? String(vars[name]) : match;
    });
  }

  function pick(value) {
    if (!value || typeof value === "string") return value || "";
    return value[lang] || value.en || "";
  }

  function countryName(code) {
    if (!code) return "";
    try {
      return new Intl.DisplayNames([lang], { type: "region" }).of(code) || code;
    } catch (error) {
      return code;
    }
  }

  function apply(scope) {
    var host = scope || document;
    host.querySelectorAll("[data-i18n]").forEach(function (node) {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    host.querySelectorAll("[data-i18n-placeholder]").forEach(function (node) {
      node.setAttribute("placeholder", t(node.getAttribute("data-i18n-placeholder")));
    });
    host.querySelectorAll("[data-i18n-aria]").forEach(function (node) {
      node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria")));
    });
  }

  function setLang(next) {
    if (LANGS.indexOf(next) < 0 || next === lang) return;
    try {
      root.localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      // Private mode: the choice lasts for this page only.
    }
    root.location.reload();
  }

  var api = {
    LANGS: LANGS,
    dict: dict,
    get lang() {
      return lang;
    },
    t: t,
    pick: pick,
    countryName: countryName,
    apply: apply,
    setLang: setLang
  };

  root.MindsetI18n = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    apply(document);
    var titleKey = document.body && document.body.getAttribute("data-title");
    if (titleKey) document.title = t(titleKey) + " · mindset";
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
