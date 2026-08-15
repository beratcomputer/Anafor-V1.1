# ANAFOR – Çoklu Süreç Takip Uygulaması

## Konsept

**Anafor**, Türkçede "girdap" anlamına gelir. Uygulama, kullanıcının günlük olarak birden fazla alışkanlığı, hedefi veya süreci takip etmesini sağlar. Her takip edilen öğe bir **Anafor** olarak adlandırılır.

Anaforlar, **Anafor Betikleri** (gruplar) içinde organize edilebilir veya bağımsız olarak tek başına var olabilir.

---

## Temel Kavramlar

### Anafor
Takip edilen tek bir süreç veya alışkanlıktır. Örnekler:
- Kalori sayımı
- Ağırlık antrenmanı
- Kitap okuma
- Meditasyon

Her anafor:
- Bir **başlangıç tarihine** sahiptir
- Her gün **✓ (Anafor)** veya **✕ (Çarpı)** ile işaretlenir
- Atlanmış günler otomatik olarak **Çarpı** sayılır
- Bir **başarı yüzdesi** barı ile gösterilir
- Bağımsız olabilir veya bir betiğe ait olabilir
- **Bitirilebilir** → bitirildiğinde arşive taşınır

### Anafor Betiği
Birden fazla anafor'u gruplamak için kullanılan bir kapsayıcıdır. Örnekler:
- "Vücut" betiği → Kalori Sayımı + Ağırlık Antrenmanı
- "Zihin" betiği → Meditasyon + Kitap Okuma

Her betik:
- İçindeki **aktif** anaforların yüzdelerinin **ortalamasını** gösterir
- Kendi barına sahiptir (ortalama bar)
- Genişletilip içindeki anaforlar görülebilir

---

## Matematik ve Bar Mekanizması

### Tekil Anafor Yüzdesi
```
yüzde = Math.round((başarılı_gün_sayısı / toplam_gün_sayısı) × 100)
```

- **başarılı_gün_sayısı:** ✓ (anafor) olarak işaretlenen günlerin sayısı
- **toplam_gün_sayısı:** Başlangıçtan bugüne kadar geçen tüm günler (atlanmış günler dahil)

### Betik Yüzdesi
```
betik_yüzde = Math.round(
  aktif_anaforların_yüzde_toplamı / aktif_anafor_sayısı
)
```

Sadece **aktif** (bitirilmemiş) anaforlar hesaba katılır.

### Bar Renk Sistemi
Tüm barlara aynı renk kuralları uygulanır:
- **< %40** → 🔴 Kırmızı gradient
- **%40 – %70** → 🟡 Sarı gradient
- **≥ %70** → 🟢 Yeşil gradient

### Animasyon
- Yüzde değeri değiştiğinde **ease-out cubic** animasyonla güncellenir
- Süre: **600ms**
- Bar genişliği **1s ease-out** transition ile değişir

---

## Atlanmış Gün Mekanizması (fillMissedDays)

Kullanıcı bir veya birden fazla gün uygulamayı açmazsa:
1. Son işlem yapılan gün ile bugün arasındaki tüm günler belirlenir
2. Bu günler otomatik olarak **Çarpı (fail)** olarak işaretlenir
3. Yüzde buna göre güncellenir

Bu mekanizma her anafor için **bağımsız** çalışır.

---

## Günlük Akış

1. Kullanıcı uygulamayı açar
2. Her aktif anafor için atlanmış günler otomatik doldurulur
3. Henüz bugün işlem yapılmamış anaforlar için ✓/✕ butonları gösterilir
4. Kullanıcı her anafor için ayrı ayrı seçim yapar
5. Seçim yapıldıktan sonra o anafor "Bugün işaretlendi" durumuna geçer

---

## Veri Yapısı

```javascript
{
  // Aktif betikler ve içindeki anaforlar
  scripts: [
    {
      id: "benzersiz-id",
      name: "Betik Adı",
      createdAt: "YYYY-MM-DD",
      anafors: [
        {
          id: "benzersiz-id",
          name: "Anafor Adı",
          startDate: "YYYY-MM-DD",
          history: [
            { date: "YYYY-MM-DD", action: "anafor" | "fail" }
          ],
          isFinished: false,
          finishedDate: null
        }
      ]
    }
  ],

  // Betiğe ait olmayan bağımsız anaforlar
  standaloneAnafors: [
    {
      id: "benzersiz-id",
      name: "Anafor Adı",
      startDate: "YYYY-MM-DD",
      history: [...],
      isFinished: false,
      finishedDate: null
    }
  ],

  // Bitirilmiş anaforlar (arşiv)
  finishedAnafors: [
    {
      id: "benzersiz-id",
      name: "Anafor Adı",
      startDate: "YYYY-MM-DD",
      finishedDate: "YYYY-MM-DD",
      history: [...],
      isFinished: true,
      originScriptName: "Betik Adı" | null
    }
  ]
}
```

---

## UI Yapısı

### Karşılama Ekranı
- İlk kullanımda gösterilir
- Sert/keskin girdap logosu
- "Başla" butonu → boş dashboard'a yönlendirir

### Ana Dashboard
- **Üst başlık:** Girdap ikonu + "ANAFOR" + tarih
- **Betik kartları:** Genişleyebilir kartlar, her birinin kendi barı
- **Bağımsız anafor kartları:** Betik dışında ayrı kartlar
- **Bitirilen Anaforlar sekmesi:** Toggle ile açılır, arşivlenmiş anaforları gösterir
- **"Anafor Ekle" butonu:** Alt kısımda floating buton

### Her Anafor Kartı İçeriği
- Anafor adı
- Başarı yüzdesi + mini bar
- Günlük ✓/✕ butonları (bugün işlem yapılmadıysa)
- "Bugün işaretlendi" mesajı (bugün işlem yapıldıysa)
- ⚙ menü: Taşı (betiğe/bağımsıza) | Bitir

### Bitirilen Anafor Kartı İçeriği
- Anafor adı + (eski betik adı varsa)
- Başarı oranı yüzdesi + bar
- Tarih aralığı: Başlangıç – Bitiş
- Geçmiş grid: Küçük hücrelerle tüm günler

---

## Özellikler

| Özellik | Açıklama |
|---------|----------|
| Anafor Ekle | Yeni bir takip süreci başlatır |
| Betik Oluştur | Anaforları gruplamak için betik oluşturur |
| Günlük İşaretleme | Her anafor için bağımsız ✓/✕ |
| Otomatik Fail | Atlanmış günler otomatik çarpı |
| Anafor Taşıma | Betikler arası veya bağımsız→betik taşıma |
| Anafor Bitirme | Anafor'u arşive taşır, geçmişi korur |
| Betik Ortalaması | İçindeki anaforların yüzde ortalaması |
| Renk Kodlu Barlar | <%40 kırmızı, %40-70 sarı, ≥%70 yeşil |
| Animasyonlu Değerler | Ease-out cubic, 600ms |
| localStorage | Tüm veriler tarayıcıda saklanır |
