# Mindset

Bir mindset, paylaşılabilir bir katalog numarasıdır. `212. mindset` adresi
`/m/212` olur.

Herkese açık olan şey bir ölçek sonucu değildir. Şu an, doğru bildiğin ve
kendini nasıl anlattığın metin olarak profilde durur. Dört açık okuma
(iş bende, bir aradayım, kuralım net, düze çıkıyor) bu metinlerin sabit
Türkçe kutup cümlelerine yakınlığıdır.

Dışarıda söylemediğin, arzu ve utandığın yan yalnız sendedir. Bu üç metin
ve onlardan çıkan dört okuma listeye, dağılıma ve profile yazılmaz.

Okuma tarayıcıda `multilingual-e5-small` ile yapılır. Metin bir modele
gönderilmez. Kod sözlüğü [`public/assets/lens-v1.js`](public/assets/lens-v1.js)
içindedir.

## Yerel

```bash
npm install
npm run check
npm run serve
```

## Yayın

Collective Bucket kalıbı: Firebase projesi `collective-bucket`, site
`cbucket-mindset`, hedef `mindset`. Adımlar
[collective-bucket/main katkı rehberinde](https://github.com/collective-bucket/main/blob/main/CONTRIBUTING.md).

Canlı site: https://cbucket-mindset.web.app

`mindset.collectivebucket.com` kaydı şu an `cmindset-auth.web.app` adresine
bakıyor. Squarespace DNS’te bu CNAME `cbucket-mindset.web.app` olunca özel
alan adı da açılır.

Sosyal katman (takip, etiket, aynı bölge, öneri) bu sürümde yoktur.
