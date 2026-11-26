// Kerangka aplikasi: pemeriksaan sesi, menu, dan perpindahan halaman lewat #/halaman atau #/halaman/bagian.
// Setiap halaman baru cukup menambah satu fungsi render dan satu baris di DAFTAR_HALAMAN.
(function () {
  var isi = document.getElementById("isi");
  var menu = document.getElementById("menu");

  // ---------- Pembantu ----------
  function el(tag, atribut, anak) {
    var e = document.createElement(tag);
    for (var k in atribut || {}) {
      if (k === "class") e.className = atribut[k];
      else e.setAttribute(k, atribut[k]);
    }
    [].concat(anak || []).forEach(function (a) {
      e.appendChild(typeof a === "string" ? document.createTextNode(a) : a);
    });
    return e;
  }

  function judul(teks, keterangan) {
    var h1 = el("h1", { tabindex: "-1" }, teks);
    var bagian = el("div", { class: "judul-halaman" }, [h1]);
    if (keterangan) bagian.appendChild(el("p", {}, keterangan));
    return bagian;
  }

  function formatAngka(n) {
    return Number(n).toLocaleString("id-ID");
  }

  function tampilkanGalat(err, ulang) {
    var kotak = el("section", { class: "panel kotak-galat", role: "alert" }, [
      el("p", {}, err.pesan || "Terjadi kesalahan. Coba lagi.")
    ]);
    var tombol = el("button", { type: "button", class: "btn btn-garis" }, "Coba lagi");
    tombol.addEventListener("click", ulang);
    kotak.appendChild(tombol);
    return kotak;
  }

  // Galat dari server: sesi habis kembali ke login, selain itu tampilkan kotak galat di "tempat".
  function tanganiGalat(err, ulang, tempat) {
    if (err.status === 401 || err.status === 403) return keLogin();
    tempat.textContent = "";
    tempat.appendChild(tampilkanGalat(err, ulang));
  }

  // Tabel kartu stok. Di HP, tiap baris otomatis menjadi kartu (lihat tema.css).
  // kolom: [{ judul, utama (kolom nama, tanpa label di HP), angka (rata kanan), isi: function(baris) }]
  function buatTabel(kolom, baris) {
    var kepala = el("thead", {}, [
      el("tr", {}, kolom.map(function (k) {
        return el("th", { class: k.angka ? "n" : "" }, k.judul);
      }))
    ]);
    var badan = el("tbody", {}, baris.map(function (b) {
      return el("tr", {}, kolom.map(function (k) {
        var kelas = (k.angka ? "n " : "") + (k.utama ? "utama" : "");
        return el("td", { class: kelas.trim(), "data-label": k.utama ? "" : k.judul }, k.isi(b));
      }));
    }));
    return el("div", { class: "tabel-gulir" }, [el("table", { class: "kartu" }, [kepala, badan])]);
  }

  // Warna label kategori: dipilih dari kode kategori, jadi satu kategori selalu berwarna sama.
  var WARNA_KATEGORI = ["antibiotik", "analgesik", "vitamin", "infus", "vaksin", "alkes", "obat-luar"];
  function lencanaKategori(k) {
    if (!k) return "-";
    var kode = String(k.kode || k.id);
    var jumlah = 0;
    for (var i = 0; i < kode.length; i++) jumlah += kode.charCodeAt(i);
    return el("span", { class: "kategori " + WARNA_KATEGORI[jumlah % WARNA_KATEGORI.length] }, k.nama || kode);
  }

  function lencanaStatus(aktif) {
    return el("span", { class: "lencana " + (aktif ? "aman" : "netral") }, aktif ? "Aktif" : "Nonaktif");
  }

  // ---------- Halaman: Dashboard ----------
  // Helper: hitung akhir bulan dari Date
  function akhirBulan(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  // Helper: selisih bulan antara dua tanggal (a - b), bisa negatif
  function selisihBulan(tglStr, sekarang) {
    var tgl = new Date(tglStr);
    return (tgl.getFullYear() - sekarang.getFullYear()) * 12 + (tgl.getMonth() - sekarang.getMonth());
  }

  function renderDashboard() {
    isi.textContent = "";
    isi.appendChild(judul("Dashboard", "Ringkasan data yang tersimpan di server."));
    var muat = el("p", { class: "status-koneksi" }, "Memuat data...");
    isi.appendChild(muat);

    Promise.all([
      LPLPO.jumlah("daftar_obat", "aktif=true"),
      LPLPO.jumlah("kategori"),
      LPLPO.jumlah("unit", "aktif=true"),
      LPLPO.jumlah("batch"),
      LPLPO.jumlah("mutasi")
    ]).then(
      function (h) {
        var data = [
          ["Obat aktif", h[0]],
          ["Kategori", h[1]],
          ["Unit aktif", h[2]],
          ["Batch", h[3]],
          ["Mutasi tercatat", h[4]]
        ];
        var grid = el("div", { class: "kartu-angka" });
        data.forEach(function (d) {
          grid.appendChild(el("div", { class: "panel" }, [
            el("div", { class: "angka" }, formatAngka(d[1])),
            el("div", { class: "nama-angka" }, d[0])
          ]));
        });
        muat.replaceWith(grid);
        isi.appendChild(el("p", { class: "status-koneksi" }, "Tersambung ke " + window.LPLPO_CONFIG.API.replace("https://", "") + "."));

        // Section batch mendekati expired
        var areaBatch = el("div", { class: "db-expired-wrap" });
        isi.appendChild(areaBatch);
        muatDashboardExpired(areaBatch);
      },
      function (err) {
        if (err.status === 401 || err.status === 403) return keLogin();
        muat.replaceWith(tampilkanGalat(err, renderDashboard));
      }
    );
  }

  function muatDashboardExpired(area) {
    var KUNCI_BULAN = "lplpo_expired_bulan";
    var nBulan;
    try { nBulan = parseInt(localStorage.getItem(KUNCI_BULAN), 10) || 3; } catch(e) { nBulan = 3; }

    area.textContent = "";

    var sekarang = new Date();
    var batasAkhir = akhirBulan(new Date(sekarang.getFullYear(), sekarang.getMonth() + nBulan - 1, 1));
    var batasStr = batasAkhir.toISOString().slice(0, 10);
    var hariIniStr = sekarang.toISOString().slice(0, 10);

    // Header section dengan kontrol N bulan
    var lblN = el("span", { class: "db-exp-label" }, "Mendekati expired (dalam ");
    var inpN = el("input", { type: "number", class: "db-exp-n", value: String(nBulan), min: "1", max: "24" });
    var lblN2 = el("span", { class: "db-exp-label" }, " bulan ke depan):");
    var hdr = el("div", { class: "db-exp-header" }, [lblN, inpN, lblN2]);
    area.appendChild(hdr);

    var areaHasil = el("div", { class: "db-exp-hasil" });
    area.appendChild(areaHasil);

    function tampilExpired() {
      areaHasil.textContent = "";
      areaHasil.appendChild(el("p", { class: "status-koneksi" }, "Memuat..."));

      LPLPO.daftar("batch", {
        perPage: 500, sort: "expired_date",
        filter: 'expired_date != "" && expired_date >= "' + hariIniStr + '" && expired_date <= "' + batasStr + '" && stok_sistem > 0',
        expand: "obat"
      }).then(function (d) {
        areaHasil.textContent = "";
        if (!d.items.length) {
          areaHasil.appendChild(el("p", { class: "status-koneksi" }, "Tidak ada batch yang akan expired dalam periode ini."));
          return;
        }
        var kolom = [
          { judul: "Nama obat", utama: true, isi: function (b) { return (b.expand && b.expand.obat && b.expand.obat.nama_utama) || b.obat; } },
          { judul: "Batch", isi: function (b) { return b.nomor_batch || "(tanpa batch)"; } },
          { judul: "ED", isi: function (b) { return formatED(b.expired_date); } },
          { judul: "Bulan tersisa", angka: true, isi: function (b) {
            var sb = selisihBulan(b.expired_date, sekarang);
            if (sb < 0) return el("span", { class: "lencana bahaya" }, "Lewat");
            if (sb === 0) return el("span", { class: "lencana peringatan" }, "Bulan ini");
            return el("span", { class: sb <= 1 ? "lencana peringatan" : "lencana netral" }, sb + " bln");
          }},
          { judul: "Stok", angka: true, isi: function (b) { return formatAngka(b.stok_sistem); } }
        ];
        areaHasil.appendChild(buatTabel(kolom, d.items));
      }, function (err) {
        areaHasil.textContent = "";
        areaHasil.appendChild(el("p", { class: "status-koneksi" }, "Gagal memuat: " + (err.pesan || err.message || "")));
      });
    }

    inpN.addEventListener("change", function () {
      var v = parseInt(inpN.value, 10);
      if (!v || v < 1) v = 1;
      if (v > 24) v = 24;
      inpN.value = v;
      nBulan = v;
      try { localStorage.setItem(KUNCI_BULAN, String(v)); } catch(e) {}
      batasAkhir = akhirBulan(new Date(sekarang.getFullYear(), sekarang.getMonth() + nBulan - 1, 1));
      batasStr = batasAkhir.toISOString().slice(0, 10);
      tampilExpired();
    });

    tampilExpired();
  }

  // ---------- Halaman: Master data (hanya baca) ----------
  var NAMA_TIPE = { sumber: "Sumber", penerima: "Penerima" };
  var NAMA_KATEGORI_UNIT = { reguler: "Reguler", non_reguler: "Non-reguler", luar: "Luar" };

  function tabMaster(aktif) {
    var nav = el("nav", { class: "tab", "aria-label": "Jenis data" });
    [["obat", "Obat"], ["unit", "Unit"], ["kategori", "Kategori"]].forEach(function (t) {
      var a = el("a", { href: "#/master/" + t[0] }, t[1]);
      if (t[0] === aktif) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    return nav;
  }

  function renderMaster(sub) {
    var bagian = { obat: daftarObat, unit: daftarUnit, kategori: daftarKategori };
    if (!bagian[sub]) sub = "obat";
    isi.textContent = "";
    isi.appendChild(judul("Master data", "Obat, unit, dan kategori yang tersimpan di server. Tampilan ini hanya untuk membaca."));
    isi.appendChild(tabMaster(sub));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    bagian[sub](area);
  }

  function daftarObat(area) {
    var s = { hal: 1, teks: "", kat: "", status: "aktif", seri: 0, timer: null };

    var cari = el("input", { type: "search", class: "cari", id: "cari-obat", placeholder: "Cari nama atau kode obat", autocomplete: "off" });
    var pilKat = el("select", { class: "pilih", id: "pilih-kategori" }, [el("option", { value: "" }, "Semua kategori")]);
    var pilStatus = el("select", { class: "pilih", id: "pilih-status" }, [
      el("option", { value: "aktif" }, "Obat aktif"),
      el("option", { value: "nonaktif" }, "Obat nonaktif"),
      el("option", { value: "" }, "Semua status")
    ]);
    var alat = el("div", { class: "alat" }, [
      el("label", { class: "sr-only", "for": "cari-obat" }, "Cari obat"), cari,
      el("label", { class: "sr-only", "for": "pilih-kategori" }, "Kategori"), pilKat,
      el("label", { class: "sr-only", "for": "pilih-status" }, "Status"), pilStatus
    ]);
    var hasil = el("div", { class: "batas-dalam", "aria-live": "polite" });
    area.appendChild(alat);
    area.appendChild(hasil);

    // Daftar kategori untuk pilihan filter. Kalau gagal, filter kategori tetap berisi "Semua".
    LPLPO.daftar("kategori", { perPage: 100, sort: "urutan" }).then(function (d) {
      d.items.forEach(function (k) {
        pilKat.appendChild(el("option", { value: k.id }, k.kode + " - " + k.nama));
      });
    }, function () {});

    function saring() {
      var f = [];
      var t = s.teks.replace(/["\\]/g, "").trim();
      if (t) {
        f.push('(nama_utama ~ "' + t + '" || kode ~ "' + t + '" || nama_alias ~ "' + t + '" || nama_lplpo ~ "' + t + '")');
      }
      if (s.kat) f.push('kategori = "' + s.kat.replace(/["\\]/g, "") + '"');
      if (s.status === "aktif") f.push("aktif = true");
      if (s.status === "nonaktif") f.push("aktif = false");
      return f.join(" && ");
    }

    function gambar(d) {
      hasil.textContent = "";
      if (!d.items.length) {
        hasil.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Tidak ada obat yang cocok. Ubah kata kunci atau filter.")
        ]));
        return;
      }
      var kolom = [
        { judul: "Nama obat", utama: true, isi: function (b) { return b.nama_utama; } },
        { judul: "Kode", isi: function (b) { return b.kode; } },
        { judul: "Kategori", isi: function (b) { return lencanaKategori(b.expand && b.expand.kategori); } },
        { judul: "Satuan", isi: function (b) { return b.satuan; } },
        { judul: "Pengelolaan", isi: function (b) { return b.pakai_batch ? "Per batch" : "Tanpa batch"; } },
        { judul: "Status", isi: function (b) { return lencanaStatus(b.aktif); } }
      ];
      hasil.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, d.items)]));

      var awal = (d.page - 1) * d.perPage + 1;
      var akhir = awal + d.items.length - 1;
      var sebelum = el("button", { type: "button", class: "btn btn-garis" }, "Sebelumnya");
      var sesudah = el("button", { type: "button", class: "btn btn-garis" }, "Berikutnya");
      if (d.page <= 1) sebelum.disabled = true;
      if (d.page >= d.totalPages) sesudah.disabled = true;
      sebelum.addEventListener("click", function () { s.hal--; muat(); window.scrollTo(0, 0); });
      sesudah.addEventListener("click", function () { s.hal++; muat(); window.scrollTo(0, 0); });
      hasil.appendChild(el("div", { class: "pager" }, [
        el("span", { class: "info" }, "Menampilkan " + formatAngka(awal) + "-" + formatAngka(akhir) + " dari " + formatAngka(d.totalItems)),
        el("div", { class: "tombol" }, [sebelum, sesudah])
      ]));
    }

    function muat() {
      var nomor = ++s.seri; // jawaban lama yang datang terlambat diabaikan
      hasil.textContent = "";
      hasil.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));
      // Di HP tiap obat menjadi kartu tinggi, jadi halaman dibuat lebih pendek.
      var perHalaman = window.matchMedia("(max-width: 720px)").matches ? 15 : 50;
      LPLPO.daftar("daftar_obat", { page: s.hal, perPage: perHalaman, sort: "kode", expand: "kategori", filter: saring() }).then(
        function (d) { if (nomor === s.seri) gambar(d); },
        function (err) { if (nomor === s.seri) tanganiGalat(err, muat, hasil); }
      );
    }

    cari.addEventListener("input", function () {
      clearTimeout(s.timer);
      s.timer = setTimeout(function () { s.teks = cari.value; s.hal = 1; muat(); }, 300);
    });
    pilKat.addEventListener("change", function () { s.kat = pilKat.value; s.hal = 1; muat(); });
    pilStatus.addEventListener("change", function () { s.status = pilStatus.value; s.hal = 1; muat(); });
    muat();
  }

  function daftarUnit(area) {
    function muat() {
      area.textContent = "";
      area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));
      LPLPO.daftar("unit", { perPage: 100, sort: "nama" }).then(function (d) {
        area.textContent = "";
        var kolom = [
          { judul: "Nama unit", utama: true, isi: function (b) { return b.nama; } },
          { judul: "Kode", isi: function (b) { return b.kode; } },
          { judul: "Tipe", isi: function (b) { return NAMA_TIPE[b.tipe] || b.tipe || "-"; } },
          { judul: "Kategori", isi: function (b) { return NAMA_KATEGORI_UNIT[b.kategori_unit] || b.kategori_unit || "-"; } },
          { judul: "Status", isi: function (b) { return lencanaStatus(b.aktif); } }
        ];
        area.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, d.items)]));
        area.appendChild(el("p", { class: "status-koneksi" }, formatAngka(d.totalItems) + " unit."));
      }, function (err) { tanganiGalat(err, muat, area); });
    }
    muat();
  }

  function daftarKategori(area) {
    function muat() {
      area.textContent = "";
      area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));
      LPLPO.daftar("kategori", { perPage: 100, sort: "urutan" }).then(function (d) {
        area.textContent = "";
        var kolom = [
          { judul: "Nama kategori", utama: true, isi: function (b) { return lencanaKategori(b); } },
          { judul: "Kode", isi: function (b) { return b.kode; } },
          { judul: "Urutan di LPLPO", isi: function (b) { return b.urutan; } }
        ];
        area.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, d.items)]));
        area.appendChild(el("p", { class: "status-koneksi" }, formatAngka(d.totalItems) + " kategori."));
      }, function (err) { tanganiGalat(err, muat, area); });
    }
    muat();
  }

  // ---------- Input tanggal dd/mm/yyyy (tiga field, navigasi otomatis) ----------
  // Mengembalikan { el: wrapperElement, getValue: fn→"YYYY-MM-DD", setValue: fn(str) }
  // onChange(isoString) dipanggil setiap kali nilai berubah lengkap.
  function buatInputTanggal(nilaiAwal, onChange, opts) {
    opts = opts || {};
    var wrap = el("div", { class: "tgl-wrap" + (opts.kelas ? " " + opts.kelas : ""), "aria-label": opts.label || "Tanggal" });

    var iDD = el("input", { type: "text", class: "tgl-dd", maxlength: "2", inputmode: "numeric",
      placeholder: "dd", "aria-label": "Tanggal", size: "2", autocomplete: "off" });
    var iMM = el("input", { type: "text", class: "tgl-mm", maxlength: "2", inputmode: "numeric",
      placeholder: "mm", "aria-label": "Bulan", size: "2", autocomplete: "off" });
    var iYY = el("input", { type: "text", class: "tgl-yy", maxlength: "4", inputmode: "numeric",
      placeholder: "yyyy", "aria-label": "Tahun", size: "4", autocomplete: "off" });

    wrap.appendChild(iDD);
    wrap.appendChild(el("span", { class: "tgl-sep", "aria-hidden": "true" }, "/"));
    wrap.appendChild(iMM);
    wrap.appendChild(el("span", { class: "tgl-sep", "aria-hidden": "true" }, "/"));
    wrap.appendChild(iYY);

    // Isi nilai awal
    function setValue(iso) {
      if (!iso) return;
      var s = String(iso).slice(0, 10);
      var parts = s.split("-");
      if (parts.length === 3) {
        iDD.value = parts[2];
        iMM.value = parts[1];
        iYY.value = parts[0];
      }
    }
    setValue(nilaiAwal);

    // Ambil nilai ISO
    function getValue() {
      var d = iDD.value.trim(), m = iMM.value.trim(), y = iYY.value.trim();
      if (!d || !m || !y || y.length < 4) return "";
      return y + "-" + m.padStart(2,"0") + "-" + d.padStart(2,"0");
    }

    function emit() { if (onChange) onChange(getValue()); }

    function hanyaAngka(e) {
      // Izinkan: angka, Backspace, Delete, Tab, arrow
      if (!/^\d$/.test(e.key) && !["Backspace","Delete","Tab","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault();
      }
    }

    function buatHandler(inp, maks, berikut) {
      inp.addEventListener("keydown", function (e) {
        hanyaAngka(e);
        if (e.key === "Backspace" && inp.value === "" && inp.previousElementSibling && inp.previousElementSibling.previousElementSibling) {
          // mundur ke field sebelumnya (lewati span pemisah)
        }
      });
      inp.addEventListener("input", function () {
        // Hanya angka
        inp.value = inp.value.replace(/\D/g, "").slice(0, maks);
        // Auto-maju
        if (inp.value.length === maks && berikut) { berikut.focus(); berikut.select(); }
        emit();
      });
      inp.addEventListener("focus", function () { inp.select(); });
    }

    buatHandler(iDD, 2, iMM);
    buatHandler(iMM, 2, iYY);
    buatHandler(iYY, 4, null);

    // Tombol kalender di ujung wrap
    var tombolKal = el("button", {
      type: "button", class: "tgl-btn-kal", "aria-label": "Pilih dari kalender", title: "Pilih tanggal"
    });
    tombolKal.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

    // Input date tersembunyi untuk native picker
    var inpNative = el("input", { type: "date", class: "tgl-inp-native", tabindex: "-1", "aria-hidden": "true" });
    tombolKal.addEventListener("click", function () {
      inpNative.focus();
      try { inpNative.showPicker(); } catch(e) { inpNative.click(); }
    });
    inpNative.addEventListener("change", function () {
      if (inpNative.value) { setValue(inpNative.value); emit(); }
    });

    wrap.appendChild(inpNative);
    wrap.appendChild(tombolKal);

    return { el: wrap, getValue: getValue, setValue: setValue };
  }

  // Warna badge per kategori (urutan → warna)
  var _katWarna = ["kat-biru","kat-hijau","kat-ungu","kat-oranye","kat-merah","kat-teal","kat-coklat","kat-pink"];
  var _katWarnaCache = {};
  function katBadgeKelas(kat) {
    if (!kat) return "kat-abu";
    var id = kat.id || kat.nama || "";
    if (!_katWarnaCache[id]) {
      var idx = 0;
      for (var i = 0; i < id.length; i++) idx = (idx * 31 + id.charCodeAt(i)) & 0xffff;
      _katWarnaCache[id] = _katWarna[idx % _katWarna.length];
    }
    return _katWarnaCache[id];
  }

  // Helper: nama obat + badge kategori inline satu baris
  function namaObatEl(obat) {
    if (!obat) return el("span", {}, "?");
    var kat = obat.expand && obat.expand.kategori;
    var singkat = kat && kat.nama_singkat;
    var wrap = el("span", { class: "obat-nama-wrap" });
    wrap.appendChild(el("span", { class: "obat-nama-utama" }, obat.nama_utama || obat.kode || "?"));
    if (singkat) {
      wrap.appendChild(el("span", { class: "obat-kat-badge " + katBadgeKelas(kat) }, singkat));
    }
    return wrap;
  }

  // Helper string (untuk konteks non-DOM, misal title/aria)
  function namaObatLabel(obat) {
    if (!obat) return "?";
    var kat = obat.expand && obat.expand.kategori;
    var singkat = kat && kat.nama_singkat;
    return singkat ? obat.nama_utama + " · " + singkat : (obat.nama_utama || obat.kode || "?");
  }

  // ---------- Modal tambah obat baru ----------
  // obatList: array live (akan di-push obat baru setelah simpan)
  // onBerhasil(obatBaru): dipanggil setelah POST berhasil
  function buatModalObatBaru(obatList, onBerhasil) {
    var overlay = el("div", { class: "modal-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Tambah obat baru" });

    function tutup() { overlay.remove(); }

    // Klik overlay untuk tutup
    overlay.addEventListener("click", function (e) { if (e.target === overlay) tutup(); });

    var kotak = el("div", { class: "modal-kotak" });
    overlay.appendChild(kotak);

    kotak.appendChild(el("div", { class: "modal-judul" }, [
      el("strong", {}, "Tambah obat baru"),
      (function () {
        var t = el("button", { type: "button", class: "modal-tutup", "aria-label": "Tutup" }, "✕");
        t.addEventListener("click", tutup);
        return t;
      })()
    ]));

    var pesan = el("p", { class: "pesan", hidden: true });

    // Form fields
    var inpNama = el("input", { type: "text", id: "mob-nama", class: "mob-inp", placeholder: "Nama utama obat", autocomplete: "off" });
    var inpNamaLplpo = el("input", { type: "text", id: "mob-nama-lplpo", class: "mob-inp", placeholder: "Nama resmi LPLPO (boleh kosong)", autocomplete: "off" });
    var inpSatuan = el("input", { type: "text", id: "mob-satuan", class: "mob-inp", placeholder: "Contoh: Tab, Kapsul, Vial", autocomplete: "off" });
    var pilKategori = el("select", { id: "mob-kategori", class: "mob-inp" }, [el("option", { value: "" }, "— Memuat kategori... —")]);
    var inpKode = el("input", { type: "text", id: "mob-kode", class: "mob-inp", placeholder: "Kode (otomatis jika kosong)", autocomplete: "off" });
    // Muat kategori
    LPLPO.daftar("kategori", { perPage: 100, sort: "urutan" }).then(function (d) {
      pilKategori.textContent = "";
      pilKategori.appendChild(el("option", { value: "" }, "— Pilih kategori —"));
      d.items.forEach(function (k) {
        pilKategori.appendChild(el("option", { value: k.id + "|" + k.kode }, k.nama + (k.nama_singkat ? " (" + k.nama_singkat + ")" : "")));
      });
    });

    var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan obat baru");

    kotak.appendChild(el("div", { class: "mob-form" }, [
      pesan,
      el("div", { class: "field" }, [el("label", { "for": "mob-nama" }, "Nama utama *"), inpNama]),
      el("div", { class: "field" }, [el("label", { "for": "mob-nama-lplpo" }, "Nama LPLPO"), inpNamaLplpo]),
      el("div", { class: "field" }, [el("label", { "for": "mob-satuan" }, "Satuan *"), inpSatuan]),
      el("div", { class: "field" }, [el("label", { "for": "mob-kategori" }, "Kategori *"), pilKategori]),
      el("div", { class: "field" }, [el("label", { "for": "mob-kode" }, "Kode"), inpKode]),
      el("div", { class: "mob-aksi" }, [tombolSimpan])
    ]));

    tombolSimpan.addEventListener("click", function () {
      var nama = inpNama.value.trim();
      var satuan = inpSatuan.value.trim();
      var katVal = pilKategori.value;

      if (!nama) { inpNama.focus(); return; }
      if (!satuan) { inpSatuan.focus(); return; }
      if (!katVal) { pilKategori.focus(); return; }

      var parts = katVal.split("|");
      var katId = parts[0];
      var katKode = parts[1] || "";

      tombolSimpan.disabled = true;
      tombolSimpan.textContent = "Menyimpan...";
      pesan.hidden = true;

      // Generate kode jika kosong: ambil kode tertinggi dari kategori ini
      var kodeManual = inpKode.value.trim();
      var lanjutSimpan = function (kodeAkhir) {
        LPLPO.buat("daftar_obat", {
          nama_utama: nama,
          nama_lplpo: inpNamaLplpo.value.trim() || undefined,
          satuan: satuan,
          kategori: katId,
          kode: kodeAkhir,
          aktif: true,
          pakai_batch: true // default: pilih batch FEFO; "Tanpa batch" selalu tersedia di dropdown
        }).then(function (obatBaru) {
          // Expand kategori manual agar namaObatLabel bisa baca nama_singkat
          obatBaru.expand = obatBaru.expand || {};
          // Tambahkan ke obatList live
          obatList.push(obatBaru);
          tutup();
          onBerhasil(obatBaru);
        }, function (err) {
          pesan.textContent = err.pesan || "Gagal menyimpan. Cek kode duplikat.";
          pesan.className = "pesan galat"; pesan.hidden = false;
          tombolSimpan.disabled = false; tombolSimpan.textContent = "Simpan obat baru";
        });
      };

      if (kodeManual) {
        // Validasi unik
        LPLPO.daftar("daftar_obat", { filter: 'kode = "' + kodeManual + '"', perPage: 1 }).then(function (d) {
          if (d.items.length) {
            pesan.textContent = "Kode " + kodeManual + " sudah dipakai.";
            pesan.className = "pesan galat"; pesan.hidden = false;
            tombolSimpan.disabled = false; tombolSimpan.textContent = "Simpan obat baru";
            inpKode.focus();
          } else {
            lanjutSimpan(kodeManual);
          }
        });
      } else {
        // Auto-generate: ambil kode tertinggi di kategori, tambah 1
        LPLPO.daftar("daftar_obat", { filter: 'kategori = "' + katId + '"', sort: "-kode", perPage: 1 }).then(function (d) {
          var nextNum = 1;
          if (d.items.length) {
            var lastKode = d.items[0].kode || "";
            var m = lastKode.match(/(\d+)$/);
            if (m) nextNum = parseInt(m[1], 10) + 1;
          }
          var kodeGen = katKode + "-" + String(nextNum).padStart(3, "0");
          lanjutSimpan(kodeGen);
        });
      }
    });

    // Esc untuk tutup
    overlay.addEventListener("keydown", function (e) { if (e.key === "Escape") tutup(); });

    document.body.appendChild(overlay);
    setTimeout(function () { inpNama.focus(); }, 50);
  }

  // ---------- Autocomplete cari obat ----------
  // onPilih(obat) dipanggil saat user memilih satu item.
  // Mengembalikan elemen wrapper yang bisa langsung dimasukkan ke DOM.
  // opsi.tampilToggleNonaktif (bool, default true) — tampilkan checkbox nonaktif
  function buatCariObat(obatList, onPilih, opsi) {
    opsi = opsi || {};
    var bolehNonaktif = opsi.tampilToggleNonaktif !== false;
    var bungkus = el("div", { class: "cari-obat-bungkus" });
    var inp = el("input", {
      type: "search", class: "cari-obat-inp",
      placeholder: "Cari nama obat...", autocomplete: "off",
      "aria-label": "Cari obat", "aria-autocomplete": "list"
    });
    // Toggle tampilkan obat nonaktif (hanya untuk penerimaan)
    var tampilNonaktif = false;
    var daftar = el("div", { class: "cari-obat-daftar", hidden: true, role: "listbox" });
    bungkus.appendChild(inp);
    bungkus.appendChild(daftar);
    if (bolehNonaktif) {
      var lblToggle = el("label", { class: "cari-obat-toggle-nonaktif", title: "Tampilkan obat yang tidak aktif" }, [
        el("input", { type: "checkbox", style: "margin-right:4px" }),
        "Tampilkan nonaktif"
      ]);
      var chkNonaktif = lblToggle.querySelector("input");
      chkNonaktif.addEventListener("change", function () {
        tampilNonaktif = chkNonaktif.checked;
        if (inp.value) buka(inp.value);
      });
      bungkus.appendChild(lblToggle);
    }

    var fokusIdx = -1;
    var itemEls = [];

    function tutup() {
      daftar.hidden = true;
      daftar.textContent = "";
      itemEls = [];
      fokusIdx = -1;
    }

    function buka(teks) {
      var t = teks.trim().toLowerCase();
      daftar.textContent = "";
      itemEls = [];
      fokusIdx = -1;

      if (!t) { daftar.hidden = true; return; }

      // Filter aktif/nonaktif, lalu cari di nama_utama, nama_alias, kode
      var pool = tampilNonaktif ? obatList : obatList.filter(function (o) { return o.aktif !== false; });
      var cocok = pool.filter(function (o) {
        return (o.nama_utama || "").toLowerCase().indexOf(t) !== -1 ||
               (o.nama_alias || "").toLowerCase().indexOf(t) !== -1 ||
               (o.kode || "").toLowerCase().indexOf(t) !== -1;
      });
      // Sort: match di awal nama_utama dulu, baru match di tengah
      cocok.sort(function (a, b) {
        var na = (a.nama_utama || "").toLowerCase();
        var nb = (b.nama_utama || "").toLowerCase();
        var aAwl = na.indexOf(t) === 0 ? 0 : 1;
        var bAwl = nb.indexOf(t) === 0 ? 0 : 1;
        if (aAwl !== bAwl) return aAwl - bAwl;
        return na.localeCompare(nb);
      });
      cocok = cocok.slice(0, 30);

      if (!cocok.length) {
        var pesanTdk = el("div", { class: "cari-obat-kosong" });
        pesanTdk.textContent = tampilNonaktif
          ? "Tidak ditemukan."
          : "Tidak ditemukan. Centang \"Tampilkan nonaktif\" untuk obat yang tidak aktif.";
        daftar.appendChild(pesanTdk);
        daftar.hidden = false;
        return;
      }

      cocok.forEach(function (o, i) {
        var kat = o.expand && o.expand.kategori;
        var katStr = kat ? kat.nama || kat.kode : "";
        var itemIsi = el("span", {});
        var namaLabel = o.nama_utama || o.kode || "?";
        if (o.aktif === false) namaLabel += " ⚠";
        itemIsi.appendChild(document.createTextNode(namaLabel));
        if (katStr) itemIsi.appendChild(el("span", { class: "cari-obat-kat" }, " — " + katStr));
        var item = el("div", {
          class: "cari-obat-item" + (o.aktif === false ? " cari-obat-nonaktif" : ""),
          role: "option", "data-idx": String(i)
        }, [itemIsi]);
        item.addEventListener("mousedown", function (e) {
          e.preventDefault(); // jaga focus tidak pindah dari inp
          inp.value = "";
          tutup();
          onPilih(o);
        });
        daftar.appendChild(item);
        itemEls.push(item);
      });

      // Auto-highlight item pertama agar bisa langsung Enter
      fokusIdx = 0;
      if (itemEls[0]) itemEls[0].classList.add("fokus");

      daftar.hidden = false;
    }

    inp.addEventListener("input", function () { buka(inp.value); });
    inp.addEventListener("focus", function () { if (inp.value) buka(inp.value); });
    inp.addEventListener("blur", function () { setTimeout(tutup, 150); });

    inp.addEventListener("keydown", function (e) {
      if (daftar.hidden) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        fokusIdx = Math.min(fokusIdx + 1, itemEls.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        fokusIdx = Math.max(fokusIdx - 1, 0);
      } else if (e.key === "Enter") {
        e.preventDefault();
        // Gunakan fokusIdx (auto-highlight item pertama sejak dropdown buka)
        var idx = fokusIdx >= 0 ? fokusIdx : 0;
        var t = inp.value.trim().toLowerCase();
        var pool2 = tampilNonaktif ? obatList : obatList.filter(function (o) { return o.aktif !== false; });
        var daftarCocok = pool2.filter(function (o) {
          return (o.nama_utama || "").toLowerCase().indexOf(t) !== -1 ||
                 (o.nama_alias || "").toLowerCase().indexOf(t) !== -1 ||
                 (o.kode || "").toLowerCase().indexOf(t) !== -1;
        }).slice(0, 30);
        var o2 = daftarCocok[idx];
        if (o2) { inp.value = ""; tutup(); onPilih(o2); }
        return;
      } else if (e.key === "Escape") {
        tutup(); return;
      }
      itemEls.forEach(function (it, i) {
        it.classList.toggle("fokus", i === fokusIdx);
      });
      if (itemEls[fokusIdx]) itemEls[fokusIdx].scrollIntoView({ block: "nearest" });
    });

    return bungkus;
  }

  // ---------- Halaman: Penerimaan ----------
  function renderPenerimaan() {
    isi.textContent = "";
    isi.appendChild(judul("Penerimaan obat", "Catat obat masuk dari sumber eksternal."));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));

    // Baca prefill dari query hash (tombol + di histori)
    var qpPnr = bacaQueryHash();

    // Muat unit sumber (tipe = "sumber") dan daftar obat aktif paralel
    Promise.all([
      LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: 'tipe = "sumber" && aktif = true' }),
      LPLPO.daftar("daftar_obat", { perPage: 500, sort: "kode", expand: "kategori" })
    ]).then(function (hasil) {
      area.textContent = "";
      var unitList  = hasil[0].items;
      var obatList  = hasil[1].items;

      if (!unitList.length) {
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Tidak ada unit sumber (tipe 'luar') yang aktif.")
        ]));
        return;
      }

      // State form — prefill dari query hash jika ada
      var prefillUnit = qpPnr.unit || "";
      var prefillTgl  = qpPnr.tgl  || hariIni();
      var state = {
        unitId: prefillUnit || (unitList.length === 1 ? unitList[0].id : ""),
        tanggal: prefillTgl,
        baris: []   // { obatId, batchId (null = baru), noBatch, ed, jumlah }
      };

      // ---------- Header form: unit sumber + tanggal ----------
      var pilUnit = el("select", { class: "pnr-select", id: "pnr-unit" },
        (unitList.length > 1 ? [el("option", { value: "" }, "— Pilih sumber —")] : [])
        .concat(unitList.map(function (u) {
          return el("option", { value: u.id }, u.nama);
        }))
      );
      if (state.unitId) pilUnit.value = state.unitId;
      var tglObj = buatInputTanggal(state.tanggal, function (iso) { state.tanggal = iso; }, { kelas: "pnr-tgl", label: "Tanggal penerimaan" });
      var inpTgl = tglObj.el;
      pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });

      var formHeader = el("div", { class: "panel pnr-header" }, [
        el("div", { class: "baris-isian" }, [
          el("div", { class: "field" }, [
            el("label", { "for": "pnr-unit" }, "Sumber"), pilUnit
          ]),
          el("div", { class: "field" }, [
            el("label", { "for": "pnr-tgl" }, "Tanggal"), inpTgl
          ])
        ])
      ]);
      area.appendChild(formHeader);

      // ---------- Tabel item ----------
      var tabelArea = el("div", { class: "batas-dalam" });
      area.appendChild(tabelArea);

      function gambarBaris() {
        tabelArea.textContent = "";
        var aktif = state.baris.filter(function (b) { return !b._hapus; });
        if (!aktif.length) {
          tabelArea.appendChild(el("p", { class: "status-koneksi" }, "Belum ada item. Tambahkan obat di bawah."));
        } else {
          aktif.forEach(function (b, idx) {
            tabelArea.appendChild(buatBarisItem(b, idx, obatList, gambarBaris));
          });
        }
      }

      // ---------- Tambah item ----------
      var cariObat = buatCariObat(obatList, function (o) {
        var sudahAda = state.baris.some(function (b) { return b.obatId === o.id && !b._hapus; });
        if (sudahAda) {
          // Obat sudah ada: tawarkan tambah baris baru (untuk batch berbeda) atau fokus ke baris pertama
          var namaO = o.nama_utama || o.kode || "obat ini";
          if (!window.confirm(namaO + " sudah ada dalam daftar.\n\nTambah baris baru untuk batch yang berbeda?")) {
            // Tidak — fokus ke jumlah baris pertama
            setTimeout(function () {
              var rows = tabelArea.querySelectorAll(".pnr-baris");
              var aktifRows = state.baris.filter(function(b){ return !b._hapus; });
              var idx = aktifRows.findIndex(function(b){ return b.obatId === o.id; });
              if (idx >= 0 && rows[idx]) {
                var inp = rows[idx].querySelector(".pnr-inp-jumlah");
                if (inp) inp.focus();
              }
            }, 50);
            return;
          }
          // Ya — tambah baris baru untuk batch kedua
        }
        state.baris.push({ obatId: o.id, tanpaBatch: !o.pakai_batch, batchId: null, noBatch: "", ed: "", jumlah: "" });
        gambarBaris();
        // Fokus ke batch select dulu (Tab lanjut ke jumlah)
        setTimeout(function () {
          var sels = tabelArea.querySelectorAll(".pnr-sel-batch");
          if (sels.length) sels[sels.length - 1].focus();
        }, 80);
      });

      var tombolObatBaru = el("button", { type: "button", class: "btn btn-garis btn-obat-baru" }, "+ Tambah obat baru");
      tombolObatBaru.addEventListener("click", function () {
        buatModalObatBaru(obatList, function (obatBaru) {
          // Langsung tambahkan ke baris penerimaan
          state.baris.push({ obatId: obatBaru.id, tanpaBatch: !obatBaru.pakai_batch, batchId: null, noBatch: "", ed: "", jumlah: "" });
          gambarBaris();
          setTimeout(function () {
            var sels = tabelArea.querySelectorAll(".pnr-sel-batch");
            if (sels.length) sels[sels.length - 1].focus();
          }, 80);
        });
      });
      var panelTambah = el("div", { class: "panel pnr-tambah" }, [cariObat, tombolObatBaru]);
      area.appendChild(panelTambah);

      // ---------- Tombol simpan (buka review dulu) ----------
      var pesanSimpan = el("p", { class: "pesan", hidden: true, style: "margin-bottom:4px" });
      var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Review & Simpan →");
      tombolSimpan.addEventListener("click", function () {
        tampilReviewPenerimaan(state, obatList, unitList, area, pesanSimpan);
      });
      var bilahSimpan = el("div", { class: "bilah-simpan" }, [tombolSimpan]);
      area.appendChild(pesanSimpan);
      area.appendChild(bilahSimpan);

      gambarBaris();
    }, function (err) {
      tanganiGalat(err, renderPenerimaan, area);
    });
  }

  // ---------- Helper: baca query string dari hash URL ----------
  function bacaQueryHash() {
    var hashQ = (location.hash || "").split("?")[1] || "";
    var qp = {};
    hashQ.split("&").forEach(function (kv) {
      var p = kv.split("="); if (p[0]) qp[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });
    return qp;
  }

  // ---------- Autocomplete cari obat ----------
  function hariIni() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // buatBarisItem: satu baris per obat — nama | batch | jumlah | ✕
  // batch: select dropdown (keyboard-friendly); kalau pilih "baru" muncul 2 field inline
  function buatBarisItem(b, idx, obatList, refresh) {
    var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
    // Default "Tanpa batch" untuk obat yang tidak dikelola per batch (diset saat baris dibuat)
    if (b.tanpaBatch === undefined) b.tanpaBatch = !obat.pakai_batch;
    // Tandai obat nonaktif di label
    var labelTeks = namaObatLabel(obat) || b.obatId;
    if (obat.aktif === false) labelTeks += " ⚠ nonaktif";
    var baris = el("div", { class: "pnr-baris" });

    // Nama obat (tidak bisa diedit, hanya label)
    var labelNama = el("span", { class: "pnr-nama" + (obat.aktif === false ? " pnr-nonaktif" : "") }, labelTeks);

    // Jumlah — dideklarasikan lebih awal agar bisa dirujuk dari event batch
    var inpJumlah = el("input", {
      type: "number", min: "1", step: "1", class: "pnr-inp-jumlah",
      placeholder: "Jml", inputmode: "numeric", value: b.jumlah || ""
    });
    inpJumlah.addEventListener("input", function () { b.jumlah = inpJumlah.value; });
    // Enter di jumlah → fokus ke cari obat berikutnya
    inpJumlah.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var cariInp = document.querySelector(".cari-obat-inp");
        if (cariInp) cariInp.focus();
      }
    });

    var satuan = el("span", { class: "pudar pnr-satuan" }, obat.satuan || "");
    // Tombol hapus
    var tombolHapus = el("button", { type: "button", class: "pnr-hapus", "aria-label": "Hapus " + (obat.nama_utama || "") }, "✕");
    tombolHapus.addEventListener("click", function () { b._hapus = true; refresh(); });

    // Dropdown batch (selalu ada; "Tanpa batch" tersedia untuk semua obat)
    var pilBatch = el("select", { class: "pnr-sel-batch", "aria-label": "Batch" });
    pilBatch.appendChild(el("option", { value: "" }, "— batch —"));
    pilBatch.appendChild(el("option", { value: OPSI_TANPA_BATCH }, "Tanpa batch"));
    pilBatch.appendChild(el("option", { value: "__baru__" }, "+ Batch baru"));
    // Pilihan awal sebelum daftar batch termuat
    if (b._batchBaru) pilBatch.value = "__baru__";
    else if (b.tanpaBatch) pilBatch.value = OPSI_TANPA_BATCH;

    // Muat batch dari server — tampilkan semua batch (termasuk sudah expired untuk penerimaan)
    daftarSemua("batch", {
      perPage: 200, sort: "expired_date,nomor_batch",
      filter: 'obat = "' + b.obatId + '"'
    }).then(function (db) {
      // Insert sebelum opsi "Tanpa batch"
      var opsTanpa = pilBatch.querySelector("option[value='" + OPSI_TANPA_BATCH + "']");
      db.items.forEach(function (bt) {
        var stok = bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : "?";
        var opt = el("option", { value: bt.id }, labelBatch(bt) + " [stok " + stok + "]");
        pilBatch.insertBefore(opt, opsTanpa);
      });
      // Restore pilihan sebelumnya
      if (b.batchId) pilBatch.value = b.batchId;
      else if (b._batchBaru) pilBatch.value = "__baru__";
      else if (b.tanpaBatch) pilBatch.value = OPSI_TANPA_BATCH;
    });

    // Field batch baru (muncul kalau pilih "+ Batch baru")
    var inpNoBatch = el("input", { type: "text", class: "pnr-inp-sm", placeholder: "No. batch (boleh kosong)", autocomplete: "off", style: "text-transform:uppercase;width:12ch" });
    var inpED = buatInputTanggal("", function(){}, { kelas: "pnr-inp-sm pnr-inp-ed-tgl", label: "Expired" });
    // ED hanya mm/yyyy — sembunyikan field dd, tampilkan cuma mm + yyyy
    inpED.el.querySelector(".tgl-dd").style.display = "none";
    inpED.el.querySelector(".tgl-sep:first-of-type").style.display = "none";
    // Restore nilai tersimpan ke DOM (penting saat gambarBaris() merender ulang)
    if (b.noBatch) inpNoBatch.value = b.noBatch;
    if (b.ed) {
      var edParts = b.ed.split("-");
      if (edParts.length >= 2) {
        var mmEl = inpED.el.querySelector(".tgl-mm");
        var yyEl = inpED.el.querySelector(".tgl-yy");
        if (mmEl) mmEl.value = edParts[1];
        if (yyEl) yyEl.value = edParts[0];
      }
    }
    inpNoBatch.addEventListener("input", function () { b.noBatch = inpNoBatch.value.toUpperCase(); inpNoBatch.value = b.noBatch; });
    // Enter di no. batch → fokus ke bulan ED
    inpNoBatch.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var mmIn = inpED.el.querySelector(".tgl-mm");
        if (mmIn) mmIn.focus();
      }
    });
    var inpEDMm = inpED.el.querySelector(".tgl-mm");
    var inpEDYy = inpED.el.querySelector(".tgl-yy");
    // Enter di bulan ED → fokus ke tahun ED
    if (inpEDMm) inpEDMm.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); if (inpEDYy) inpEDYy.focus(); }
    });
    // Enter di tahun ED → fokus ke jumlah
    if (inpEDYy) inpEDYy.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); inpJumlah.focus(); }
    });
    inpED.el.addEventListener("focusout", function () {
      var mm = inpED.el.querySelector(".tgl-mm").value;
      var yy = inpED.el.querySelector(".tgl-yy").value;
      // ED boleh kosong — batch tanpa expired_date tetap valid
      if (mm && yy && yy.length === 4) b.ed = yy + "-" + mm.padStart(2,"0") + "-01";
      else if (!mm && !yy) b.ed = "";
      // jika hanya sebagian diisi, biarkan b.ed tetap seperti sebelumnya
    });
    var formBaru = el("span", { class: "pnr-form-baru", hidden: !b._batchBaru }, [inpNoBatch, inpED.el]);

    pilBatch.addEventListener("change", function () {
      var v = pilBatch.value;
      if (v === "__baru__") {
        b.batchId = null; b._batchBaru = true; b.tanpaBatch = false;
        formBaru.hidden = false; inpNoBatch.focus();
      } else {
        var adaBatch = !!v && v !== OPSI_TANPA_BATCH;
        b.batchId = adaBatch ? v : null;
        b.tanpaBatch = (v === OPSI_TANPA_BATCH);
        b._batchBaru = false;
        formBaru.hidden = true;
        // Ambil data batch terpilih (untuk label review)
        if (adaBatch) {
          var opts = pilBatch.options;
          for (var i = 0; i < opts.length; i++) {
            if (opts[i].value === v) { b.noBatch = opts[i].text.replace(/ \[stok .*\]$/, ""); break; }
          }
        }
        inpJumlah.focus();
      }
    });

    baris.appendChild(labelNama);
    baris.appendChild(pilBatch);
    baris.appendChild(formBaru);
    baris.appendChild(inpJumlah);
    baris.appendChild(satuan);
    baris.appendChild(tombolHapus);
    return baris;
  }

  // Batch pada baris penerimaan sudah lengkap? (pilih batch ada, "Tanpa batch",
  // atau batch baru dengan nomor atau ED terisi — nomor boleh kosong asal ada ED)
  function penerimaanBatchOk(b) {
    if (b.tanpaBatch || b.batchId) return true;
    if (b._batchBaru) return !!(String(b.noBatch || "").trim() || b.ed);
    return false;
  }

  // Helper: update stok_sistem di daftar_obat dengan delta (+ masuk, - keluar)
  function updateStokObat(obatId, delta) {
    var s = LPLPO.sesi() || {};
    var api = window.LPLPO_CONFIG.API;
    return fetch(api + "/api/collections/daftar_obat/records/" + obatId, {
      headers: { Authorization: s.token || "" }
    }).then(function (r) { return r.json(); }).then(function (obat) {
      var stokLama = obat.stok_sistem !== undefined && obat.stok_sistem !== null ? obat.stok_sistem : 0;
      return fetch(api + "/api/collections/daftar_obat/records/" + obatId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: s.token || "" },
        body: JSON.stringify({ stok_sistem: stokLama + delta })
      });
    });
  }

  // ---------- Review sebelum simpan (penerimaan) ----------
  function tampilReviewPenerimaan(state, obatList, unitList, area, pesanLama) {
    // Validasi awal sebelum tampil review
    if (!state.unitId) {
      pesanLama.textContent = "Pilih sumber terlebih dahulu.";
      pesanLama.className = "pesan galat"; pesanLama.hidden = false; return;
    }
    if (!state.tanggal) {
      pesanLama.textContent = "Isi tanggal penerimaan.";
      pesanLama.className = "pesan galat"; pesanLama.hidden = false; return;
    }
    var aktif = state.baris.filter(function (b) { return !b._hapus; });
    var valid = aktif.filter(function (b) {
      return b.jumlah && Number(b.jumlah) > 0 && penerimaanBatchOk(b);
    });
    if (!valid.length) {
      pesanLama.textContent = "Tambahkan minimal satu item dengan jumlah.";
      pesanLama.className = "pesan galat"; pesanLama.hidden = false; return;
    }
    var tidakLengkap = aktif.filter(function (b) {
      if (!b.jumlah || Number(b.jumlah) < 1) return true;
      if (!penerimaanBatchOk(b)) return true;
      return false;
    });
    if (tidakLengkap.length) {
      pesanLama.textContent = tidakLengkap.length + " item belum lengkap.";
      pesanLama.className = "pesan galat"; pesanLama.hidden = false; return;
    }

    var unitObj = unitList.filter(function (u) { return u.id === state.unitId; })[0] || {};

    // Buat panel review — overlay di atas area
    var panel = el("div", { class: "panel review-panel" });
    panel.appendChild(el("h2", { class: "review-judul" }, "Konfirmasi penerimaan"));

    // Info header
    var infoGrid = el("div", { class: "review-info" }, [
      el("div", {}, [el("span", { class: "pudar" }, "Sumber: "), el("strong", {}, unitObj.nama || state.unitId)]),
      el("div", {}, [el("span", { class: "pudar" }, "Tanggal: "), el("strong", {}, formatTglPanjang(state.tanggal))])
    ]);
    panel.appendChild(infoGrid);

    // Tabel item
    var tbody = el("tbody");
    valid.forEach(function (b, i) {
      var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
      var batchLabel = "Tanpa batch";
      if (b._batchBaru) {
        batchLabel = labelBatch({ nomor_batch: b.noBatch, expired_date: b.ed }) + " (baru)";
      } else if (b.batchId) {
        batchLabel = b.noBatch || "batch ada";
      }
      var nonaktifBadge = obat.aktif === false ? el("span", { class: "review-badge-nonaktif" }, " → akan diaktifkan") : null;
      var namaTd = el("td", {});
      namaTd.appendChild(document.createTextNode(obat.nama_utama || b.obatId));
      if (nonaktifBadge) namaTd.appendChild(nonaktifBadge);
      tbody.appendChild(el("tr", {}, [
        el("td", { class: "pudar", style: "font-size:12px;padding-right:4px" }, String(i + 1)),
        namaTd,
        el("td", { class: "pudar", style: "font-size:12px" }, batchLabel),
        el("td", { class: "n", style: "text-align:right;font-variant-numeric:tabular-nums" },
          formatAngka(Number(b.jumlah)) + " " + (obat.satuan || ""))
      ]));
    });
    var tabelReview = el("table", { class: "review-tabel" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", {}, "#"), el("th", {}, "Obat"), el("th", {}, "Batch"), el("th", { class: "n" }, "Jumlah")
      ])]),
      tbody
    ]);
    panel.appendChild(tabelReview);

    // Pesan error simpan
    var pesanReview = el("p", { class: "pesan", hidden: true });
    panel.appendChild(pesanReview);

    // Tombol
    var tombolKembali = el("button", { type: "button", class: "btn btn-sekunder" }, "← Kembali edit");
    var tombolKonfirmasi = el("button", { type: "button", class: "btn btn-utama" }, "Konfirmasi & Simpan");

    tombolKembali.addEventListener("click", function () {
      panel.remove();
    });

    tombolKonfirmasi.addEventListener("click", function () {
      tombolKonfirmasi.disabled = true; tombolKembali.disabled = true;
      tombolKonfirmasi.textContent = "Menyimpan...";
      simpanPenerimaan(state, obatList, tombolKonfirmasi, pesanReview, area);
    });

    panel.appendChild(el("div", { class: "bilah-simpan" }, [tombolKembali, pesanReview, tombolKonfirmasi]));
    // Tampilkan di atas area dengan scroll ke atas
    area.appendChild(panel);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function simpanPenerimaan(state, obatList, tombol, pesan, area) {
    if (!state.unitId) {
      pesan.textContent = "Pilih sumber terlebih dahulu.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }
    if (!state.tanggal) {
      pesan.textContent = "Isi tanggal penerimaan.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    // Filter baris yang dihapus
    state.baris = state.baris.filter(function (b) { return !b._hapus; });

    var valid = state.baris.filter(function (b) {
      // pakai_batch=false: cukup ada jumlah
      // pakai_batch=true: harus ada batchId (existing) atau _batchBaru
      return b.jumlah && Number(b.jumlah) > 0 && penerimaanBatchOk(b);
    });

    if (!valid.length) {
      pesan.textContent = "Tambahkan minimal satu item dengan jumlah dan batch.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    var tidakLengkap = state.baris.filter(function (b) {
      if (b._hapus) return false;
      if (!b.jumlah || Number(b.jumlah) < 1) return true;
      // pakai_batch=true wajib punya batch
      if (!penerimaanBatchOk(b)) return true;
      return false;
    });
    if (tidakLengkap.length) {
      pesan.textContent = tidakLengkap.length + " item belum lengkap (jumlah atau batch kosong).";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    tombol.disabled = true; tombol.textContent = "Menyimpan...";
    pesan.hidden = true;

    // Proses berurutan: untuk setiap baris, buat batch baru dulu kalau perlu, lalu buat mutasi
    var unitItem = null;
    // Cari jenis unit sumber untuk menentukan jenis mutasi
    LPLPO.daftar("unit", { filter: 'id = "' + state.unitId + '"', perPage: 1 }).then(function (du) {
      unitItem = du.items[0];
      var jenis = (unitItem && unitItem.tipe === "penerima") ? "keluar" : "masuk";

      // Auto-aktifkan obat yang nonaktif tapi ada di penerimaan ini
      var nonaktifIds = valid.map(function (b) {
        var o = obatList.filter(function (x) { return x.id === b.obatId; })[0];
        return (o && o.aktif === false) ? b.obatId : null;
      }).filter(Boolean);
      var unikNonaktif = nonaktifIds.filter(function (id, i) { return nonaktifIds.indexOf(id) === i; });
      var aktifkanSemua = unikNonaktif.length
        ? Promise.all(unikNonaktif.map(function (id) { return LPLPO.ubah("daftar_obat", id, { aktif: true }); }))
        : Promise.resolve();

      // Proses satu per satu (tidak paralel, agar mudah debug)
      // Guard retry: baris yang mutasinya sudah tersimpan (_tersimpan) tidak disimpan ulang,
      // supaya klik ulang setelah gagal di tengah jalan tidak membuat mutasi duplikat.
      var antrian = valid.filter(function (b) { return !b._tersimpan; });
      var hasil = state._hasil = state._hasil || [];

      function prosesBerikutnya() {
        if (!antrian.length) {
          // Update aktif di obatList lokal agar tampilan label ikut update
          unikNonaktif.forEach(function (id) {
            var o = obatList.filter(function (x) { return x.id === id; })[0];
            if (o) o.aktif = true;
          });
          tampilRingkasan(area, hasil, obatList, state);
          return;
        }
        var b = antrian.shift();
        var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};

        function buatMutasi(batchId) {
          var delta = jenis === "masuk" ? Number(b.jumlah) : -Number(b.jumlah);
          return LPLPO.buat("mutasi", {
            obat: b.obatId,
            batch: batchId || undefined,
            unit: state.unitId,
            jenis: jenis,
            jumlah: Number(b.jumlah),
            tanggal: state.tanggal,
            status: "confirmed",
            catatan: ""
          }).then(function () {
            b._tersimpan = true; // mutasi sudah masuk; jangan disimpan lagi bila ada retry
            // Update stok_sistem di batch, lalu di daftar_obat
            var pStok;
            if (batchId) {
              pStok = ambilBatch(batchId).then(function (bt) {
                var stokBaru = (bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : (bt.stok_awal || 0)) + delta;
                return LPLPO.ubah("batch", batchId, { stok_sistem: stokBaru });
              }).then(function () {
                return updateStokObat(b.obatId, delta);
              });
            } else {
              pStok = updateStokObat(b.obatId, delta);
            }
            pStok.then(function () {
              hasil.push({ obat: obat, jumlah: Number(b.jumlah) });
              tombol.textContent = "Menyimpan... (" + hasil.length + "/" + valid.length + ")";
              prosesBerikutnya();
            }, function () {
              // Stok gagal update tapi mutasi sudah tersimpan — catat tetap lanjut
              hasil.push({ obat: obat, jumlah: Number(b.jumlah) });
              tombol.textContent = "Menyimpan... (" + hasil.length + "/" + valid.length + ")";
              prosesBerikutnya();
            });
          }, function (err) {
            pesan.textContent = "Gagal menyimpan " + (obat.nama_utama || "") + ": " + (err && err.pesan || "error");
            pesan.className = "pesan galat"; pesan.hidden = false;
            tombol.disabled = false; tombol.textContent = "Konfirmasi & Simpan";
          });
        }

        function ambilBatch(batchId) {
          if (typeof LPLPO.ambil === "function") return LPLPO.ambil("batch", batchId);
          var s = LPLPO.sesi() || {};
          return fetch(window.LPLPO_CONFIG.API + "/api/collections/batch/records/" + batchId, {
            headers: { Authorization: s.token || "" }
          }).then(function (r) { return r.json(); });
        }

        if (b._batchBaru) {
          // Pakai ulang batch yang sama (obat + nomor + ED bulan sama), kalau belum ada baru dibuat.
          // Nomor kosong dengan ED terisi = batch "tanpa nomor" yang sah.
          var noB = String(b.noBatch || "").trim().toUpperCase();
          daftarSemua("batch", { perPage: 200, filter: 'obat = "' + b.obatId + '"' }).then(function (dbAda) {
            var ada = dbAda.items.filter(function (x) {
              return String(x.nomor_batch || "").trim().toUpperCase() === noB &&
                     kunciED(x.expired_date) === kunciED(b.ed);
            })[0];
            if (ada) return ada;
            return LPLPO.buat("batch", {
              obat: b.obatId,
              nomor_batch: noB,
              expired_date: b.ed || "",
              stok_awal: 0,
              stok_sistem: 0
            });
          }).then(function (bt) {
            b.batchId = bt.id; b._batchBaru = false; // retry memakai batch ini, tidak bikin lagi
            b.noBatch = labelBatch(bt);
            buatMutasi(bt.id);
          }, function (err) {
            pesan.textContent = "Gagal membuat batch untuk " + (obat.nama_utama || "") + ": " + (err.pesan || "");
            pesan.className = "pesan galat"; pesan.hidden = false;
            tombol.disabled = false; tombol.textContent = "Konfirmasi & Simpan";
          });
        } else {
          buatMutasi(b.batchId);
        }
      }
      // Aktifkan obat nonaktif dulu, lalu mulai proses
      aktifkanSemua.then(function () {
        prosesBerikutnya();
      }, function () {
        // Gagal aktifkan — tetap lanjut, hanya log
        prosesBerikutnya();
      });
    }, function (err) {
      pesan.textContent = err.pesan || "Gagal memuat data unit.";
      pesan.className = "pesan galat"; pesan.hidden = false;
      tombol.disabled = false; tombol.textContent = "Konfirmasi & Simpan";
    });
  }

  function tampilRingkasan(area, hasilList, obatList, state) {
    area.textContent = "";
    area.appendChild(judul("Penerimaan tersimpan", "Berikut obat yang berhasil dicatat."));

    // Urutkan berdasarkan kategori.urutan lalu obat.posisi
    hasilList.sort(function (a, b) {
      var katA = (a.obat.expand && a.obat.expand.kategori) || {};
      var katB = (b.obat.expand && b.obat.expand.kategori) || {};
      var uA = katA.urutan || "99"; var uB = katB.urutan || "99";
      if (uA !== uB) return uA.localeCompare(uB);
      return (a.obat.posisi || 0) - (b.obat.posisi || 0);
    });

    var kolom = [
      { judul: "Nama obat", utama: true, isi: function (r) { return r.obat.nama_utama || "-"; } },
      { judul: "Kategori", isi: function (r) { return lencanaKategori(r.obat.expand && r.obat.expand.kategori); } },
      { judul: "Jumlah", angka: true, isi: function (r) { return formatAngka(r.jumlah) + " " + (r.obat.satuan || ""); } }
    ];
    area.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, hasilList)]));

    // Tombol aksi setelah simpan
    var tombolHistori = el("button", { type: "button", class: "btn btn-sekunder" }, "Lihat di histori");
    tombolHistori.addEventListener("click", function () {
      var q = "unit=" + encodeURIComponent(state.unitId || "") + "&tgl=" + encodeURIComponent(state.tanggal || "");
      location.hash = "#/histori?" + q;
    });
    var tombolBaru = el("button", { type: "button", class: "btn btn-utama" }, "Catat penerimaan baru");
    tombolBaru.addEventListener("click", renderPenerimaan);
    area.appendChild(el("div", { class: "bilah-simpan" }, [tombolHistori, tombolBaru]));
  }

  // ---------- Halaman: Pengeluaran ----------
  function renderPengeluaran() {
    isi.textContent = "";
    isi.appendChild(judul("Pengeluaran obat", "Catat obat keluar ke unit."));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));

    // Baca prefill dari query hash (tombol + di histori)
    var qpPgl = bacaQueryHash();

    Promise.all([
      LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: 'tipe = "penerima" && aktif = true' }),
      LPLPO.daftar("daftar_obat", { perPage: 500, sort: "kode", expand: "kategori", filter: "aktif = true" }),
      LPLPO.daftar("permintaan_unit", { perPage: 50, sort: "-created", filter: 'status = "pending"', expand: "unit" })
    ]).then(function (hasil) {
      area.textContent = "";
      var unitList = hasil[0].items;
      var obatList = hasil[1].items;
      var permintaanList = hasil[2].items;

      if (permintaanList.length) {
        var perUnit = {};
        permintaanList.forEach(function (p) {
          var uid = p.unit;
          var unitNama = (p.expand && p.expand.unit && p.expand.unit.nama) || uid;
          if (!perUnit[uid]) perUnit[uid] = { nama: unitNama, items: [] };
          perUnit[uid].items.push(p);
        });

        var notifKartu = el("div", { class: "panel" });
        notifKartu.appendChild(el("p", { style: "margin:0 0 12px; font-weight:600" },
          permintaanList.length + " permintaan belum diproses:"));

        var daftarNotif = el("div", { class: "batas-dalam" });
        Object.keys(perUnit).forEach(function (uid) {
          var grup = perUnit[uid];
          var baris = el("div", { style: "display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:6px 0; border-top:1px solid var(--garis)" }, [
            el("span", {}, grup.nama + " \xb7 " + grup.items.length + " item"),
            el("button", { type: "button", class: "btn btn-garis", style: "min-height:36px; padding:0 12px; font-size:15px" }, "Isi sekarang")
          ]);
          baris.querySelector("button").addEventListener("click", function () {
            renderPengeluaranDariPermintaan(area, unitList, obatList, grup.items, uid);
          });
          daftarNotif.appendChild(baris);
        });
        notifKartu.appendChild(daftarNotif);
        area.appendChild(notifKartu);
      }

      // Prefill dari query hash jika ada
      var prefillUnitPgl = qpPgl.unit || "";
      var prefillTglPgl  = qpPgl.tgl  || hariIni();
      var state = { unitId: prefillUnitPgl, tanggal: prefillTglPgl, baris: [], permintaanIds: [] };

      var pilUnit = el("select", { class: "pnr-select", id: "pgl-unit" },
        [el("option", { value: "" }, "— Pilih unit tujuan —")]
        .concat(unitList.map(function (u) {
          return el("option", { value: u.id }, u.nama);
        }))
      );
      if (state.unitId) pilUnit.value = state.unitId;
      var tglObj = buatInputTanggal(state.tanggal, function (iso) { state.tanggal = iso; }, { kelas: "pnr-tgl", label: "Tanggal pengeluaran" });
      var inpTgl = tglObj.el;
      pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });

      var formHeader = el("div", { class: "panel pnr-header", id: "pgl-form-header" }, [
        el("div", { class: "baris-isian" }, [
          el("div", { class: "field" }, [el("label", { "for": "pgl-unit" }, "Unit tujuan"), pilUnit]),
          el("div", { class: "field" }, [el("label", { "for": "pgl-tgl" }, "Tanggal"), inpTgl])
        ])
      ]);
      area.appendChild(formHeader);

      var tabelArea = el("div", { class: "batas-dalam" });
      area.appendChild(tabelArea);

      function gambarBaris() {
        tabelArea.textContent = "";
        state.baris = state.baris.filter(function (b) { return !b._hapus; });
        if (!state.baris.length) {
          tabelArea.appendChild(el("p", { class: "status-koneksi" }, "Belum ada item."));
        } else {
          state.baris.forEach(function (b, idx) {
            tabelArea.appendChild(buatBarisKeluarItem(b, idx, obatList, gambarBaris, state));
          });
        }
      }

      var cariObatPgl = buatCariObat(obatList, function (o) {
        // Obat yang sama boleh punya beberapa baris (batch berbeda); batch otomatis
        // memilih FEFO berikutnya yang belum dipakai baris lain.
        state.baris.push({ obatId: o.id, batchId: null, jumlah: "" });
        gambarBaris();
        // Fokus ke batch select (FEFO sudah auto-pilih, Tab ke jumlah)
        setTimeout(function () {
          var sels = tabelArea.querySelectorAll(".pnr-sel-batch");
          if (sels.length) sels[sels.length - 1].focus();
        }, 80);
      }, { tampilToggleNonaktif: false });

      area.appendChild(el("div", { class: "panel pnr-tambah" }, [cariObatPgl]));

      var pesanSimpan = el("p", { class: "pesan", hidden: true, style: "margin-bottom:4px" });
      var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Review & Simpan →");
      tombolSimpan.addEventListener("click", function () {
        tampilReviewPengeluaran(state, obatList, unitList, area, pesanSimpan);
      });
      area.appendChild(pesanSimpan);
      area.appendChild(el("div", { class: "bilah-simpan" }, [tombolSimpan]));

      gambarBaris();
    }, function (err) {
      tanganiGalat(err, renderPengeluaran, area);
    });
  }

  // ---------- Review sebelum simpan (pengeluaran) ----------
  function tampilReviewPengeluaran(state, obatList, unitList, area, pesanLama) {
    if (!state.unitId) {
      pesanLama.textContent = "Pilih unit tujuan terlebih dahulu.";
      pesanLama.className = "pesan galat"; pesanLama.hidden = false; return;
    }
    if (!state.tanggal) {
      pesanLama.textContent = "Isi tanggal pengeluaran.";
      pesanLama.className = "pesan galat"; pesanLama.hidden = false; return;
    }
    var aktif = state.baris.filter(function (b) { return !b._hapus; });
    var valid = aktif.filter(function (b) {
      return b.jumlah && Number(b.jumlah) > 0 && (b.batchId || b.tanpaBatch);
    });
    if (!valid.length) {
      pesanLama.textContent = "Tambahkan minimal satu item dengan jumlah dan batch.";
      pesanLama.className = "pesan galat"; pesanLama.hidden = false; return;
    }
    var tidakLengkap = aktif.filter(function (b) {
      return !b.jumlah || Number(b.jumlah) < 1 || (!b.batchId && !b.tanpaBatch);
    });
    if (tidakLengkap.length) {
      pesanLama.textContent = tidakLengkap.length + " item belum lengkap.";
      pesanLama.className = "pesan galat"; pesanLama.hidden = false; return;
    }

    var unitObj = unitList.filter(function (u) { return u.id === state.unitId; })[0] || {};

    var panel = el("div", { class: "panel review-panel" });
    panel.appendChild(el("h2", { class: "review-judul" }, "Konfirmasi pengeluaran"));

    var infoGrid = el("div", { class: "review-info" }, [
      el("div", {}, [el("span", { class: "pudar" }, "Unit tujuan: "), el("strong", {}, unitObj.nama || state.unitId)]),
      el("div", {}, [el("span", { class: "pudar" }, "Tanggal: "), el("strong", {}, formatTglPanjang(state.tanggal))])
    ]);
    panel.appendChild(infoGrid);

    var tbody = el("tbody");
    valid.forEach(function (b, i) {
      var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
      var batchLabel = b.tanpaBatch ? "Tanpa batch" : (b.batchNomor || b.batchId || "");
      tbody.appendChild(el("tr", {}, [
        el("td", { class: "pudar", style: "font-size:12px;padding-right:4px" }, String(i + 1)),
        el("td", {}, obat.nama_utama || b.obatId),
        el("td", { class: "pudar", style: "font-size:12px" }, batchLabel),
        el("td", { class: "n", style: "text-align:right;font-variant-numeric:tabular-nums" },
          formatAngka(Number(b.jumlah)) + " " + (obat.satuan || ""))
      ]));
    });
    var tabelReview = el("table", { class: "review-tabel" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", {}, "#"), el("th", {}, "Obat"), el("th", {}, "Batch"), el("th", { class: "n" }, "Jumlah")
      ])]),
      tbody
    ]);
    panel.appendChild(tabelReview);

    var pesanReview = el("p", { class: "pesan", hidden: true });

    var tombolKembali = el("button", { type: "button", class: "btn btn-sekunder" }, "← Kembali edit");
    var tombolKonfirmasi = el("button", { type: "button", class: "btn btn-utama" }, "Konfirmasi & Simpan");

    tombolKembali.addEventListener("click", function () { panel.remove(); });
    tombolKonfirmasi.addEventListener("click", function () {
      tombolKonfirmasi.disabled = true; tombolKembali.disabled = true;
      tombolKonfirmasi.textContent = "Menyimpan...";
      simpanPengeluaran(state, obatList, tombolKonfirmasi, pesanReview, area);
    });

    panel.appendChild(el("div", { class: "bilah-simpan" }, [tombolKembali, pesanReview, tombolKonfirmasi]));
    area.appendChild(panel);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderPengeluaranDariPermintaan(area, unitList, obatList, permintaanItems, unitId) {
    var formHeader = document.getElementById("pgl-form-header");
    if (!formHeader) return;
    var toRemove = [];
    var node = formHeader;
    while (node) { toRemove.push(node); node = node.nextElementSibling; }
    toRemove.forEach(function (n) { n.remove(); });

    var state = {
      unitId: unitId,
      tanggal: hariIni(),
      baris: permintaanItems.map(function (p) {
        return { obatId: p.obat, batchId: null, jumlah: String(p.jumlah_minta || ""), permintaanId: p.id };
      }),
      permintaanIds: permintaanItems.map(function (p) { return p.id; })
    };

    var unitNama = (unitList.filter(function (u) { return u.id === unitId; })[0] || {}).nama || unitId;

    var pilUnit = el("select", { class: "pnr-select", id: "pgl-unit" },
      [el("option", { value: unitId, selected: "selected" }, unitNama)]
      .concat(unitList.filter(function (u) { return u.id !== unitId; }).map(function (u) {
        return el("option", { value: u.id }, u.nama);
      }))
    );
    var tglObj = buatInputTanggal(state.tanggal, function (iso) { state.tanggal = iso; }, { kelas: "pnr-tgl", label: "Tanggal pengeluaran" });
    var inpTgl = tglObj.el;
    pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });

    var formHeader2 = el("div", { class: "panel pnr-header", id: "pgl-form-header" }, [
      el("div", { class: "baris-isian" }, [
        el("div", { class: "field" }, [el("label", { "for": "pgl-unit" }, "Unit tujuan"), pilUnit]),
        el("div", { class: "field" }, [el("label", { "for": "pgl-tgl" }, "Tanggal"), inpTgl])
      ])
    ]);
    area.appendChild(formHeader2);

    var tabelArea = el("div", { class: "batas-dalam" });
    area.appendChild(tabelArea);

    function gambarBaris() {
      tabelArea.textContent = "";
      state.baris = state.baris.filter(function (b) { return !b._hapus; });
      if (!state.baris.length) {
        tabelArea.appendChild(el("p", { class: "status-koneksi" }, "Belum ada item."));
      } else {
        state.baris.forEach(function (b, idx) {
          tabelArea.appendChild(buatBarisKeluarItem(b, idx, obatList, gambarBaris, state));
        });
      }
    }

    var cariObatDp = buatCariObat(obatList, function (o) {
      // Obat yang sama boleh punya beberapa baris (batch berbeda)
      state.baris.push({ obatId: o.id, batchId: null, jumlah: "" });
      gambarBaris();
      setTimeout(function () {
        var sels = tabelArea.querySelectorAll(".pnr-sel-batch");
        if (sels.length) sels[sels.length - 1].focus();
      }, 80);
    });

    area.appendChild(el("div", { class: "panel pnr-tambah" }, [cariObatDp]));

    var pesanSimpan = el("p", { class: "pesan", hidden: true });
    var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan pengeluaran");
    tombolSimpan.addEventListener("click", function () {
      simpanPengeluaran(state, obatList, tombolSimpan, pesanSimpan, area);
    });
    area.appendChild(el("div", { class: "bilah-simpan" }, [pesanSimpan, tombolSimpan]));

    gambarBaris();
  }

  // buatBarisKeluarItem: nama | batch select (FEFO, stok > 0, + "Tanpa batch") | jumlah | satuan | ✕
  // - Obat yang sama boleh punya beberapa baris (batch berbeda).
  // - Sisa batch dikurangi jumlah yang sudah dipakai baris lain untuk batch yang sama.
  // - Jumlah > sisa → peringatan (tidak memblokir) + tombol ambil sisanya dari batch berikutnya.
  function buatBarisKeluarItem(b, idx, obatList, refresh, state) {
    var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
    var bungkus = el("div", { class: "pnr-baris-bungkus" });
    var baris = el("div", { class: "pnr-baris" });
    var peringatan = el("div", { class: "pnr-peringatan", hidden: true });
    bungkus.appendChild(baris);
    bungkus.appendChild(peringatan);

    var labelNama = el("span", { class: "pnr-nama" }, [
      document.createTextNode(namaObatLabel(obat) || b.obatId),
      b.permintaanId ? el("span", { class: "pudar", style: "font-size:12px;margin-left:4px" }, "(permintaan)") : document.createTextNode("")
    ]);

    // Cache batch + stok tanpa batch per obat (sekali ambil per sesi form, dipakai semua baris obat itu)
    state.cacheBatch = state.cacheBatch || {};
    function muatBatch() {
      if (!state.cacheBatch[b.obatId]) {
        state.cacheBatch[b.obatId] = Promise.all([
          daftarSemua("batch", {
            perPage: 200, sort: "expired_date,nomor_batch",
            filter: 'obat = "' + b.obatId + '" && stok_sistem > 0'
          }),
          hitungStokTanpaBatch(b.obatId).then(null, function () { return null; })
        ]).then(function (h) { return { batch: h[0].items, tanpa: h[1] }; });
      }
      return state.cacheBatch[b.obatId];
    }

    var batchMap = {};
    var tanpaStok = null;

    function barisLain() {
      return state.baris.filter(function (x) { return x !== b && !x._hapus && x.obatId === b.obatId; });
    }
    function dipakaiLain(kunci) { // kunci: batchId atau OPSI_TANPA_BATCH
      var t = 0;
      barisLain().forEach(function (x) {
        var k = x.tanpaBatch ? OPSI_TANPA_BATCH : x.batchId;
        if (k === kunci) t += Number(x.jumlah) || 0;
      });
      return t;
    }
    function batchTerpakaiLain(batchId) {
      return barisLain().some(function (x) { return x.batchId === batchId; });
    }
    function cekSemua() {
      state.baris.forEach(function (x) { if (x._cek) x._cek(); });
    }

    // Sisa stok untuk pilihan baris ini (null = belum diketahui)
    function sisaIni() {
      if (b.tanpaBatch) return tanpaStok === null ? null : tanpaStok - dipakaiLain(OPSI_TANPA_BATCH);
      var bt = batchMap[b.batchId];
      if (!bt) return null;
      return (Number(bt.stok_sistem) || 0) - dipakaiLain(b.batchId);
    }

    // Baris baru untuk sisa kekurangan: batch FEFO berikutnya yang belum dipakai, kalau habis → Tanpa batch
    function tambahBarisKekurangan(kurang) {
      var baru = {
        obatId: b.obatId, batchId: null, jumlah: String(kurang),
        permintaanIndukId: b.permintaanId || b.permintaanIndukId || undefined
      };
      var i = state.baris.indexOf(b);
      state.baris.splice(i + 1, 0, baru);
      refresh();
    }

    b._cek = function () {
      peringatan.textContent = "";
      peringatan.hidden = true;
      var sisa = sisaIni();
      var jml = Number(b.jumlah) || 0;
      if (sisa === null || jml <= 0 || jml <= sisa) return;
      var sisaPos = Math.max(sisa, 0);
      var kurang = jml - sisaPos;
      peringatan.hidden = false;
      peringatan.appendChild(document.createTextNode(
        "Sisa pilihan ini " + sisaPos + ", kurang " + kurang + ". "));
      if (sisaPos > 0) {
        var tombolSisa = el("button", { type: "button", class: "btn btn-garis pnr-btn-sisa" },
          "+ Ambil " + kurang + " dari batch berikutnya");
        tombolSisa.addEventListener("click", function () {
          b.jumlah = String(sisaPos);
          tambahBarisKekurangan(kurang);
        });
        peringatan.appendChild(tombolSisa);
      } else {
        peringatan.appendChild(document.createTextNode("Pilih batch lain atau \"Tanpa batch\"."));
      }
    };

    // Select batch
    var pilBatch = el("select", { class: "pnr-sel-batch", "aria-label": "Batch FEFO" });
    pilBatch.appendChild(el("option", { value: "" }, "— batch —"));

    function setPilihan() {
      if (b.tanpaBatch) pilBatch.value = OPSI_TANPA_BATCH;
      else if (b.batchId) pilBatch.value = b.batchId;
    }

    muatBatch().then(function (data) {
      tanpaStok = data.tanpa;
      data.batch.forEach(function (bt) {
        var stok = bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : 0;
        pilBatch.appendChild(el("option", { value: bt.id }, labelBatch(bt) + " [stok " + stok + "]"));
        batchMap[bt.id] = bt;
      });
      pilBatch.appendChild(el("option", { value: OPSI_TANPA_BATCH },
        "Tanpa batch" + (data.tanpa !== null ? " [stok " + data.tanpa + "]" : "")));

      // Auto-pilih untuk baris baru: obat tanpa pengelolaan batch → Tanpa batch;
      // selain itu batch FEFO pertama yang belum dipakai baris lain; kalau habis → Tanpa batch
      if (!b.batchId && !b.tanpaBatch) {
        if (!obat.pakai_batch) {
          b.tanpaBatch = true;
        } else {
          var pilih = null;
          for (var i = 0; i < data.batch.length; i++) {
            if (!batchTerpakaiLain(data.batch[i].id)) { pilih = data.batch[i]; break; }
          }
          if (pilih) { b.batchId = pilih.id; b.batchNomor = labelBatch(pilih); }
          else b.tanpaBatch = true;
        }
        if (b.tanpaBatch) b.batchNomor = "Tanpa batch";
      }
      setPilihan();
      cekSemua();
    });

    pilBatch.addEventListener("change", function () {
      var v = pilBatch.value;
      if (v === OPSI_TANPA_BATCH) {
        b.tanpaBatch = true; b.batchId = null; b.batchNomor = "Tanpa batch";
      } else {
        b.tanpaBatch = false; b.batchId = v || null;
        var bt = batchMap[b.batchId];
        b.batchNomor = bt ? labelBatch(bt) : "";
      }
      cekSemua();
    });
    // Enter/Space di select → fokus ke jumlah
    pilBatch.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); inpJumlah.focus(); }
    });

    var inpJumlah = el("input", {
      type: "number", min: "1", step: "1", class: "pnr-inp-jumlah",
      placeholder: "Jml", inputmode: "numeric", value: b.jumlah || ""
    });
    inpJumlah.addEventListener("input", function () { b.jumlah = inpJumlah.value; cekSemua(); });
    inpJumlah.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var cariInp = document.querySelector(".cari-obat-inp");
        if (cariInp) cariInp.focus();
      }
    });

    var satuan = el("span", { class: "pudar pnr-satuan" }, obat.satuan || "");
    var tombolHapus = el("button", { type: "button", class: "pnr-hapus", "aria-label": "Hapus " + (obat.nama_utama || "") }, "✕");
    tombolHapus.addEventListener("click", function () { b._hapus = true; refresh(); });

    baris.appendChild(labelNama);
    baris.appendChild(pilBatch);
    baris.appendChild(inpJumlah);
    baris.appendChild(satuan);
    baris.appendChild(tombolHapus);
    return bungkus;
  }

  function simpanPengeluaran(state, obatList, tombol, pesan, area) {
    if (!state.unitId) {
      pesan.textContent = "Pilih unit tujuan.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }
    if (!state.tanggal) {
      pesan.textContent = "Isi tanggal pengeluaran.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }
    state.baris = state.baris.filter(function (b) { return !b._hapus; });
    if (!state.baris.length) {
      pesan.textContent = "Tambahkan minimal satu item.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }
    var tidakLengkap = state.baris.filter(function (b) {
      return !b.jumlah || Number(b.jumlah) < 1 || (!b.batchId && !b.tanpaBatch);
    });
    if (tidakLengkap.length) {
      pesan.textContent = tidakLengkap.length + " item belum lengkap (jumlah atau batch belum dipilih).";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    tombol.disabled = true; tombol.textContent = "Menyimpan...";
    pesan.hidden = true;

    // Guard retry: baris yang mutasinya sudah tersimpan (_tersimpan) tidak disimpan ulang
    var antrian = state.baris.filter(function (b) { return !b._tersimpan; });
    var hasilList = state._hasil = state._hasil || [];

    function prosesBerikutnya() {
      if (!antrian.length) {
        var updateList = state.baris.filter(function (b) { return b.permintaanId; });
        if (!updateList.length) {
          tampilRingkasanKeluar(area, hasilList, obatList, state);
          return;
        }
        var uAntrian = updateList.slice();
        function updateBerikutnya() {
          if (!uAntrian.length) { tampilRingkasanKeluar(area, hasilList, obatList, state); return; }
          var b = uAntrian.shift();
          // jumlah_beri = total semua baris dari permintaan ini (termasuk baris tambahan beda batch)
          var totalBeri = 0;
          state.baris.forEach(function (x) {
            if (x.permintaanId === b.permintaanId || x.permintaanIndukId === b.permintaanId) {
              totalBeri += Number(x.jumlah) || 0;
            }
          });
          LPLPO.ubah("permintaan_unit", b.permintaanId, {
            status: "selesai",
            jumlah_beri: totalBeri
          }).then(updateBerikutnya, updateBerikutnya);
        }
        updateBerikutnya();
        return;
      }
      var b = antrian.shift();
      var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
      LPLPO.buat("mutasi", {
        obat: b.obatId,
        batch: b.batchId || undefined, // "Tanpa batch" → relasi batch kosong
        unit: state.unitId,
        jenis: "keluar",
        jumlah: Number(b.jumlah),
        tanggal: state.tanggal,
        status: "confirmed",
        catatan: ""
      }).then(function () {
        b._tersimpan = true; // mutasi sudah masuk; jangan disimpan lagi bila ada retry
        // Update stok_sistem di batch, lalu di daftar_obat
        var ambilBatchKeluar = typeof LPLPO.ambil === "function"
          ? function (id) { return LPLPO.ambil("batch", id); }
          : function (id) {
              var s = LPLPO.sesi() || {};
              return fetch(window.LPLPO_CONFIG.API + "/api/collections/batch/records/" + id, {
                headers: { Authorization: s.token || "" }
              }).then(function (r) { return r.json(); });
            };
        var pStokKeluar;
        if (b.batchId) {
          pStokKeluar = ambilBatchKeluar(b.batchId).then(function (bt) {
            var stokBaru = (bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : (bt.stok_awal || 0)) - Number(b.jumlah);
            return LPLPO.ubah("batch", b.batchId, { stok_sistem: stokBaru });
          }).then(function () {
            return updateStokObat(b.obatId, -Number(b.jumlah));
          });
        } else {
          pStokKeluar = updateStokObat(b.obatId, -Number(b.jumlah));
        }
        pStokKeluar.then(function () {
          hasilList.push({ obat: obat, jumlah: Number(b.jumlah) });
          tombol.textContent = "Menyimpan... (" + hasilList.length + "/" + state.baris.length + ")";
          prosesBerikutnya();
        }, function () {
          // Stok gagal tapi mutasi tersimpan — lanjut
          hasilList.push({ obat: obat, jumlah: Number(b.jumlah) });
          tombol.textContent = "Menyimpan... (" + hasilList.length + "/" + state.baris.length + ")";
          prosesBerikutnya();
        });
      }, function (err) {
        pesan.textContent = "Gagal menyimpan " + (obat.nama_utama || "") + ": " + (err && err.pesan || "error");
        pesan.className = "pesan galat"; pesan.hidden = false;
        tombol.disabled = false; tombol.textContent = "Konfirmasi & Simpan";
      });
    }
    prosesBerikutnya();
  }

  function tampilRingkasanKeluar(area, hasilList, obatList, state) {
    area.textContent = "";
    area.appendChild(judul("Pengeluaran tersimpan", "Berikut obat yang berhasil dicatat."));

    hasilList.sort(function (a, b) {
      var katA = (a.obat.expand && a.obat.expand.kategori) || {};
      var katB = (b.obat.expand && b.obat.expand.kategori) || {};
      var uA = katA.urutan || "99"; var uB = katB.urutan || "99";
      if (uA !== uB) return uA.localeCompare(uB);
      return (a.obat.posisi || 0) - (b.obat.posisi || 0);
    });

    var kolom = [
      { judul: "Nama obat", utama: true, isi: function (r) { return r.obat.nama_utama || "-"; } },
      { judul: "Kategori", isi: function (r) { return lencanaKategori(r.obat.expand && r.obat.expand.kategori); } },
      { judul: "Jumlah", angka: true, isi: function (r) { return formatAngka(r.jumlah) + " " + (r.obat.satuan || ""); } }
    ];
    area.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, hasilList)]));

    var tombolCetak = el("button", { type: "button", class: "btn btn-garis" }, "Cetak tanda terima");
    tombolCetak.addEventListener("click", function () { cetakTandaTerima(hasilList, state); });
    var tombolHistori = el("button", { type: "button", class: "btn btn-sekunder" }, "Lihat di histori");
    tombolHistori.addEventListener("click", function () {
      var q = "unit=" + encodeURIComponent(state.unitId || "") + "&tgl=" + encodeURIComponent(state.tanggal || "");
      location.hash = "#/histori?" + q;
    });
    var tombolBaru = el("button", { type: "button", class: "btn btn-utama" }, "Catat pengeluaran baru");
    tombolBaru.addEventListener("click", renderPengeluaran);
    area.appendChild(el("div", { class: "bilah-simpan" }, [tombolCetak, tombolHistori, tombolBaru]));
  }

  // Print tanda terima dari histori (grup mutasi per tanggal+unit)
  function cetakTandaTerimaHistori(grup, tgl, unitObj, jenis) {
    var tglFmt = new Date(tgl).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    var unitNama = unitObj.nama || "-";
    var judulDok = jenis === "masuk" ? "TANDA TERIMA PENERIMAAN OBAT" : "BUKTI PENGELUARAN OBAT";
    var labelPihak1 = jenis === "masuk" ? "Diserahkan oleh" : "Diserahkan oleh";
    var labelPihak2 = jenis === "masuk" ? "Diterima oleh" : "Diterima oleh";
    var labelUnit = jenis === "masuk" ? "Sumber" : "Kepada";
    var baris = grup.map(function (m, i) {
      var obatE = m.expand && m.expand.obat;
      var batchE = m.expand && m.expand.batch;
      var namaObat = obatE ? (obatE.nama_utama || obatE.kode || "-") : (m.obat || "-");
      var satuan = obatE ? (obatE.satuan || "") : "";
      var noBatch = batchE ? (batchE.nomor_batch || "-") : "-";
      var edBatch = batchE && batchE.expired_date ? formatED(batchE.expired_date) : "-";
      return "<tr><td>" + (i + 1) + "</td><td>" + namaObat + "</td><td>" + satuan + "</td>" +
             "<td>" + noBatch + "</td><td>" + edBatch + "</td>" +
             "<td style='text-align:right'>" + formatAngka(m.jumlah) + "</td></tr>";
    }).join("");
    var html = "<!doctype html><html><head><meta charset='utf-8'><title>" + judulDok + "</title>" +
      "<style>body{font-family:sans-serif;font-size:13px;padding:20px;max-width:700px;margin:0 auto}" +
      "h2{margin:0 0 4px}p{margin:0 0 6px}" +
      "table{width:100%;border-collapse:collapse;margin-top:8px}" +
      "th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}" +
      "th{background:#f0f0f0}" +
      ".ttd{margin-top:40px;display:flex;justify-content:space-between}" +
      ".ttd div{text-align:center;width:200px}" +
      "@media print{button{display:none}}</style></head><body>" +
      "<h2>" + judulDok + "</h2>" +
      "<p>Puskesmas Tambang Ulang</p>" +
      "<p>Tanggal: " + tglFmt + " &nbsp;|&nbsp; " + labelUnit + ": <strong>" + unitNama + "</strong></p>" +
      "<table><thead><tr><th>#</th><th>Nama Obat</th><th>Sat.</th><th>No. Batch</th><th>ED</th><th>Jumlah</th></tr></thead>" +
      "<tbody>" + baris + "</tbody></table>" +
      "<div class='ttd'>" +
      "<div><p style='margin-top:60px'>_______________</p><p>" + labelPihak1 + "</p></div>" +
      "<div><p style='margin-top:60px'>_______________</p><p>" + labelPihak2 + "</p></div>" +
      "</div>" +
      "<button onclick='window.print()' style='margin-top:20px;padding:8px 20px'>Cetak</button>" +
      "</body></html>";
    var w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  function cetakTandaTerima(hasilList, state) {
    var baris = hasilList.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + (r.obat.nama_utama || "-") + "</td>" +
             "<td>" + (r.obat.satuan || "") + "</td>" +
             "<td style='text-align:right'>" + formatAngka(r.jumlah) + "</td></tr>";
    }).join("");
    var tgl = new Date(state.tanggal);
    var tglFmt = tgl.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    var html = "<!doctype html><html><head><meta charset='utf-8'><title>Tanda Terima</title>" +
      "<style>body{font-family:sans-serif;font-size:13px;padding:20px;max-width:600px;margin:0 auto}" +
      "h2{margin:0 0 4px}p{margin:0 0 12px}" +
      "table{width:100%;border-collapse:collapse;margin-top:8px}" +
      "th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}" +
      "th{background:#f0f0f0}" +
      ".ttd{margin-top:40px;display:flex;justify-content:space-between}" +
      ".ttd div{text-align:center;width:200px}" +
      "@media print{button{display:none}}</style></head><body>" +
      "<h2>TANDA TERIMA OBAT</h2>" +
      "<p>Puskesmas Tambang Ulang</p>" +
      "<p>Tanggal: " + tglFmt + "</p>" +
      "<table><thead><tr><th>#</th><th>Nama Obat</th><th>Satuan</th><th>Jumlah</th></tr></thead>" +
      "<tbody>" + baris + "</tbody></table>" +
      "<div class='ttd'>" +
      "<div><p style='margin-top:60px'>_______________</p><p>Diserahkan oleh</p></div>" +
      "<div><p style='margin-top:60px'>_______________</p><p>Diterima oleh</p></div>" +
      "</div>" +
      "<button onclick='window.print()' style='margin-top:20px;padding:8px 20px'>Cetak</button>" +
      "</body></html>";
    var w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  // ---------- Halaman: Stockopname ----------

// ---------- Halaman: Stockopname ----------

  // Ambil atau buat SO draft untuk bulan ini.
  // Kembalikan Promise<{id, status}> record stockopname.
  function ambilAtauBuatSO() {
    var now = new Date();
    var tglAwal = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01";
    var tglAkhirD = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    var tglAkhir = tglAkhirD.getFullYear() + "-" + String(tglAkhirD.getMonth() + 1).padStart(2, "0") + "-01";

    return LPLPO.daftar("stockopname", {
      filter: 'tanggal >= "' + tglAwal + '" && tanggal < "' + tglAkhir + '"',
      perPage: 1,
      sort: "-created"
    }).then(function (d) {
      if (d.items && d.items.length) return d.items[0];
      // Belum ada → buat baru
      return LPLPO.buat("stockopname", {
        tanggal: tglAwal,
        status: "draft",
        catatan: ""
      });
    });
  }

  // Ambil semua stockopname_item untuk SO tertentu.
  function ambilItemSO(soId) {
    return daftarSemua("stockopname_item", {
      filter: 'stockopname = "' + soId + '"',
      perPage: 200
    });
  }

  // Simpan/update satu item SO. Kembalikan Promise<record>.
  function simpanItemSO(soId, batchId, obatId, stokFisik, itemId) {
    var data = {
      stockopname: soId,
      // Baris virtual "Tanpa batch" (id "tb:...") disimpan dengan relasi batch kosong
      batch: (batchId && String(batchId).indexOf(PREFIKS_TANPA) === 0) ? undefined : batchId,
      obat: obatId,
      stok_fisik: stokFisik
    };
    if (itemId) {
      return LPLPO.ubah("stockopname_item", itemId, { stok_fisik: stokFisik });
    }
    return LPLPO.buat("stockopname_item", data);
  }

  // Tanda ringan "hitung nanti" per batch di SO tab 1. Disimpan di localStorage perangkat ini
  // (tidak membuat record di PocketBase), per SO.
  function bacaTandaSO(soId) {
    try { return JSON.parse(localStorage.getItem("lplpo_so_tanda_" + soId) || "{}") || {}; } catch (e) { return {}; }
  }
  function simpanTandaSO(soId, obj) {
    try { localStorage.setItem("lplpo_so_tanda_" + soId, JSON.stringify(obj)); } catch (e) {}
  }

  // Tampilan tabel penuh (tanpa mengubah tabel jadi kartu di layar sempit), diingat per perangkat
  function tabelPenuhAktif() {
    try { return localStorage.getItem("lplpo_tabel_penuh") === "1"; } catch (e) { return false; }
  }
  function aturTabelPenuh(aktif) {
    document.documentElement.classList.toggle("tabel-penuh", !!aktif);
    try { localStorage.setItem("lplpo_tabel_penuh", aktif ? "1" : "0"); } catch (e) {}
  }
  document.documentElement.classList.toggle("tabel-penuh", tabelPenuhAktif());

  // soAktifId: ID stockopname yang sedang dipakai (dipilih user), atau null
  var soAktifId = null;

  function renderStockopname() {
    isi.textContent = "";
    isi.appendChild(judul("Stockopname", "Cocokkan stok fisik dengan stok sistem. Isi jumlah fisik per batch, lalu simpan."));

    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);

    var hashSub = (location.hash || "").replace(/^#\/stockopname\/?/, "");
    var subBagian = hashSub.split("/");
    var sub = subBagian[0] || "hitung";
    var subObatId = subBagian[1] || "";
    if (sub !== "sesuaikan" && sub !== "item") sub = "hitung";

    // Jika ada soAktifId (user sudah pilih periode), langsung ke tab
    if (soAktifId) {
      renderSOTabs(area, soAktifId, sub, subObatId);
      return;
    }

    // Tampilkan pilih periode SO
    tampilPilihPeriodeSO(area, function (soId) {
      soAktifId = soId;
      renderSOTabs(area, soId, sub, subObatId);
    });
  }

  function formatBulanSO(tgl) {
    if (!tgl) return "?";
    var d = new Date(tgl);
    if (isNaN(d)) return tgl.slice(0, 7);
    return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }

  // Format tanggal pendek untuk tabel: dd-mm-yy (misal "15-10-26")
  function formatTglPendek(tgl) {
    if (!tgl) return "—";
    var s = typeof tgl === "string" ? tgl.slice(0, 10) : "";
    if (!s || s.length < 10) return tgl ? String(tgl).slice(0, 10) : "—";
    var parts = s.split("-");
    if (parts.length !== 3) return s;
    return parts[2] + "-" + parts[1] + "-" + parts[0].slice(2);
  }

  // Format tanggal panjang untuk judul/heading: dd mmmm yyyy (misal "15 Oktober 2026")
  function formatTglPanjang(tgl) {
    if (!tgl) return "?";
    var d = new Date(tgl);
    if (isNaN(d)) return String(tgl).slice(0, 10);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  }

  function tampilPilihPeriodeSO(area, onPilih) {
    area.textContent = "";
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat daftar stockopname..."));

    LPLPO.daftar("stockopname", { perPage: 50, sort: "-tanggal" }).then(function (d) {
      area.textContent = "";

      var daftarSO = d.items || [];

      var kartuPilih = el("div", { class: "panel" });
      kartuPilih.appendChild(el("h3", { style: "margin:0 0 12px; font-size:15px" }, "Pilih periode stockopname"));

      if (daftarSO.length) {
        var ul = el("ul", { class: "so-periode-list" });
        daftarSO.forEach(function (so) {
          var bulan = formatBulanSO(so.tanggal);
          var statusBadge = el("span", { class: "so-status-badge so-status-" + (so.status || "draft") }, so.status || "draft");
          var tombol = el("button", { type: "button", class: "so-periode-btn" }, "");
          tombol.appendChild(el("span", { class: "so-periode-nama" }, bulan));
          tombol.appendChild(statusBadge);
          tombol.addEventListener("click", function () { onPilih(so.id); });
          ul.appendChild(el("li", {}, [tombol]));
        });
        kartuPilih.appendChild(ul);
      } else {
        kartuPilih.appendChild(el("p", { class: "pudar", style: "margin:0 0 12px" }, "Belum ada stockopname. Buat yang pertama:"));
      }

      kartuPilih.appendChild(el("hr", { style: "margin:12px 0" }));
      kartuPilih.appendChild(el("p", { class: "pudar", style: "margin:0 0 8px; font-size:13px" }, "Atau buat stockopname baru untuk periode tertentu:"));

      var now = new Date();
      var akhirBulan = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      var tglDefault = akhirBulan.getFullYear() + "-" + String(akhirBulan.getMonth() + 1).padStart(2, "0") + "-" + String(akhirBulan.getDate()).padStart(2, "0");
      var tglSOObj = buatInputTanggal(tglDefault, function(){}, { kelas: "so-inp-edit", label: "Tanggal stockopname" });
      var inpTgl = tglSOObj.el;
      var inpCatatan = el("input", { type: "text", class: "so-inp-edit", placeholder: "Catatan (opsional)", "aria-label": "Catatan" });
      var tombolBuat = el("button", { type: "button", class: "btn btn-utama" }, "+ Buat SO baru");
      var pesanBuat = el("p", { class: "pesan", hidden: true });

      tombolBuat.addEventListener("click", function () {
        var tglVal = tglSOObj.getValue();
        if (!tglVal) {
          pesanBuat.textContent = "Pilih tanggal SO (format: dd/mm/yyyy).";
          pesanBuat.className = "pesan galat"; pesanBuat.hidden = false; return;
        }
        tombolBuat.disabled = true; tombolBuat.textContent = "Membuat...";
        LPLPO.buat("stockopname", {
          tanggal: tglVal,
          status: "draft",
          catatan: inpCatatan.value || ""
        }).then(function (so) {
          onPilih(so.id);
        }, function (err) {
          pesanBuat.textContent = (err && (err.pesan || err.message)) || "Gagal membuat SO.";
          pesanBuat.className = "pesan galat"; pesanBuat.hidden = false;
          tombolBuat.disabled = false; tombolBuat.textContent = "+ Buat SO baru";
        });
      });

      kartuPilih.appendChild(el("div", { style: "display:flex; gap:8px; flex-wrap:wrap; align-items:center" }, [inpTgl, inpCatatan, tombolBuat]));
      kartuPilih.appendChild(pesanBuat);
      area.appendChild(kartuPilih);
    }, function (err) {
      tanganiGalat(err, renderStockopname, area);
    });
  }

  function renderSOTabs(area, soId, sub, subObatId) {
    area.textContent = "";

    // Tombol ganti periode
    var tombolGanti = el("button", { type: "button", class: "btn btn-garis", style: "font-size:12px; margin-bottom:8px" }, "← Ganti periode");
    tombolGanti.addEventListener("click", function () {
      soAktifId = null;
      renderStockopname();
    });
    var tombolTabel = el("button", { type: "button", class: "btn btn-garis so-btn-tampilan", style: "font-size:12px; margin-bottom:8px; margin-left:6px" }, "");
    function labelTombolTabel() { tombolTabel.textContent = tabelPenuhAktif() ? "▤ Tampilan kartu" : "▦ Tampilan tabel"; }
    labelTombolTabel();
    tombolTabel.addEventListener("click", function () { aturTabelPenuh(!tabelPenuhAktif()); labelTombolTabel(); });
    area.appendChild(tombolGanti);
    area.appendChild(tombolTabel);

    var tabNav = el("nav", { class: "tab", "aria-label": "Tahap stockopname" });
    var tabHitung    = el("a", { href: "#/stockopname/hitung" }, "1 · Penghitungan");
    var tabSesuaikan = el("a", { href: "#/stockopname/sesuaikan" }, "2 · Penyesuaian");
    tabNav.appendChild(tabHitung);
    tabNav.appendChild(tabSesuaikan);
    area.appendChild(tabNav);

    var kontenTab = el("div", { class: "batas-dalam" });
    area.appendChild(kontenTab);

    // Muat info SO untuk label status
    kontenTab.appendChild(el("p", { class: "status-koneksi" }, "Memuat..."));
    LPLPO.daftar("stockopname", { filter: 'id = "' + soId + '"', perPage: 1 }).then(function (d) {
      var so = (d.items && d.items[0]) || { id: soId, status: "draft", tanggal: "" };
      kontenTab.textContent = "";

      var lblStatus = el("div", { class: "so-status-label so-periode-judul" }, [
        el("strong", {}, "Periode " + formatBulanSO(so.tanggal)),
        el("span", { class: "so-status-badge so-status-" + (so.status || "draft") }, so.status || "draft")
      ]);
      // Judul periode ditaruh di luar kontenTab, karena tiap tahap mengosongkan kontenTab saat dirender
      area.insertBefore(lblStatus, kontenTab);

      if (sub === "item" && subObatId) {
        tabSesuaikan.setAttribute("aria-current", "page");
        renderDetailItem(kontenTab, soId, subObatId, so.tanggal || "");
      } else if (sub === "hitung") {
        tabHitung.setAttribute("aria-current", "page");
        tahapHitung(kontenTab, soId, lblStatus);
      } else {
        tabSesuaikan.setAttribute("aria-current", "page");
        tahapSesuaikan(kontenTab, soId);
      }
    }, function (err) {
      kontenTab.textContent = "";
      tanganiGalat(err, renderStockopname, kontenTab);
    });
  }

  // Format tanggal ED: "Jan 2026" atau "-"
  function formatED(tgl) {
    if (!tgl) return "-";
    var d = new Date(tgl);
    if (isNaN(d)) return tgl;
    return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
  }

  // Apakah ED sudah lewat?
  function edLewat(tgl) {
    if (!tgl) return false;
    var d = new Date(tgl);
    if (isNaN(d)) return false;
    var sekarang = new Date();
    return d < new Date(sekarang.getFullYear(), sekarang.getMonth(), 1);
  }

  // Muat semua halaman hasil (PocketBase membatasi perPage), lalu kembalikan { items }.
  function daftarSemua(koleksi, opsi) {
    var semua = [];
    function ambil(hal) {
      var o = {};
      for (var k in opsi) o[k] = opsi[k];
      o.page = hal;
      return LPLPO.daftar(koleksi, o).then(function (d) {
        semua = semua.concat(d.items);
        if (d.page >= d.totalPages || !d.items.length) return { items: semua };
        return ambil(hal + 1);
      });
    }
    return ambil(1);
  }

  // ---------- Batch: konstanta & helper bersama ----------
  // Nilai opsi dropdown untuk "Tanpa batch" (mutasi disimpan dengan batch kosong)
  var OPSI_TANPA_BATCH = "__tanpa__";

  // Label batch: "NOMOR · Mei 2027" atau "(tanpa nomor) · Mei 2027"
  function labelBatch(bt) {
    var no = (bt.nomor_batch || "").trim();
    return (no || "(tanpa nomor)") + (bt.expired_date ? " · " + formatED(bt.expired_date) : "");
  }

  // Kunci ED per bulan: "2027-09" (dari "2027-09-01 00:00:00.000Z" atau "2027-09-01")
  function kunciED(tgl) { return tgl ? String(tgl).slice(0, 7) : ""; }

  // Stok "tanpa batch" satu obat = Σ masuk − Σ keluar dari mutasi yang tidak punya relasi batch.
  // sampaiTgl opsional ("YYYY-MM-DD HH:MM:SS"); kosong = semua mutasi (live).
  function hitungStokTanpaBatch(obatId, sampaiTgl) {
    var f = 'obat = "' + obatId + '" && batch = ""';
    if (sampaiTgl) f += ' && tanggal <= "' + sampaiTgl + '"';
    return daftarSemua("mutasi", { perPage: 500, filter: f, sort: "tanggal,id" }).then(function (d) {
      var s = 0;
      d.items.forEach(function (tx) {
        var j = Number(tx.jumlah) || 0;
        s += (tx.jenis === "masuk") ? j : -j;
      });
      return s;
    });
  }

  // ---------- Stockopname: baris virtual "Tanpa batch" ----------
  // Baris ini bukan record batch. Id-nya "tb:<obatId>"; di stockopname_item disimpan dengan
  // batch kosong dan obat terisi. Stok sistemnya selalu dihitung dari mutasi tanpa batch s.d. cutoff.
  var PREFIKS_TANPA = "tb:";
  function idBatchTanpa(obatId) { return PREFIKS_TANPA + obatId; }

  // Kunci item SO di itemIndex: id batch, atau "tb:<obatId>" bila batch kosong
  function kunciItemSO(si) { return si.batch ? si.batch : idBatchTanpa(si.obat); }

  // Cutoff SO = hari terakhir bulan SO, pukul 23:59:59
  function cutoffDariTanggal(tgl) {
    if (!tgl) return "9999-12-31 23:59:59";
    var p = String(tgl).slice(0, 10).split("-");
    var akhir = new Date(parseInt(p[0], 10), parseInt(p[1], 10), 0);
    return akhir.getFullYear() + "-" + String(akhir.getMonth() + 1).padStart(2, "0") + "-" +
           String(akhir.getDate()).padStart(2, "0") + " 23:59:59";
  }
  function ambilCutoffSO(soId) {
    return LPLPO.daftar("stockopname", { filter: 'id = "' + soId + '"', perPage: 1 }).then(function (d) {
      var so = (d.items && d.items[0]) || {};
      return cutoffDariTanggal(so.tanggal);
    });
  }

  // Bangun baris virtual "Tanpa batch" (array objek mirip batch) untuk SO.
  // Dibuat untuk obat aktif yang: punya mutasi tanpa batch s.d. cutoff, atau sudah punya item SO
  // tanpa batch, atau pakai_batch=false. Satu fetch mutasi untuk semua obat.
  function bangunBatchTanpa(cutoff, obatList, soItems) {
    return daftarSemua("mutasi", {
      perPage: 500, sort: "tanggal,id",
      filter: 'batch = "" && tanggal <= "' + cutoff + '"'
    }).then(function (dm) {
      var saldo = {}, ada = {};
      dm.items.forEach(function (tx) {
        if (!tx.obat) return;
        ada[tx.obat] = true;
        var j = Number(tx.jumlah) || 0;
        saldo[tx.obat] = (saldo[tx.obat] || 0) + (tx.jenis === "masuk" ? j : -j);
      });
      soItems.forEach(function (si) { if (!si.batch && si.obat) ada[si.obat] = true; });
      var hasil = [];
      obatList.forEach(function (o) {
        if (o.aktif === false) return;
        if (!ada[o.id] && o.pakai_batch !== false) return;
        hasil.push({
          id: idBatchTanpa(o.id), _tanpa: true, obat: o.id,
          nomor_batch: "", expired_date: "", stok_awal: 0,
          _stok_sistem: saldo[o.id] || 0,
          expand: { obat: o }
        });
      });
      return hasil;
    });
  }

  // Hapus satu record.
  function hapusRecord(koleksi, id) {
    if (typeof LPLPO.hapus === "function") return LPLPO.hapus(koleksi, id);
    var s = LPLPO.sesi() || {};
    return fetch(window.LPLPO_CONFIG.API + "/api/collections/" + koleksi + "/records/" + id, {
      method: "DELETE",
      headers: { Authorization: s.token || "" }
    }).then(function (r) {
      if (r.ok) return true;
      var e = new Error("Gagal menghapus");
      e.status = r.status;
      e.pesan = "Gagal menghapus (kode " + r.status + ").";
      throw e;
    });
  }

  var soPesanTerakhir = "";
  var soBukaManual = {}; // "<soId>:<obatId>" → true bila panel obat stok nol dibuka manual (bertahan selama sesi)

  // Teks gabungan untuk pencarian obat: nama_utama + nama_lplpo + alias + kode (huruf kecil)
  function teksCariObat(o) {
    return [o.nama_utama, o.nama_lplpo, (o.nama_alias || "").replace(/\|/g, " "), o.kode].join(" ").toLowerCase();
  }

  function tahapHitung(area, soId, lblStatus) {
    area.textContent = "";
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data batch..."));

    var URUT_KAT = ["A","T","B","F","D","C","E","G","H","I","J","K","L","M","V","W","N","O","P","Q","R","S","X","U","Y"];
    function urutObatKode(kode) {
      if (!kode) return [99, "", ""];
      var bagian = kode.split("-");
      var kat = bagian[0] || "";
      var idx = URUT_KAT.indexOf(kat);
      return [idx === -1 ? 98 : idx, kat, kode];
    }

    // Muat batch, item SO, semua obat, dan cutoff SO secara paralel; lalu bangun baris "Tanpa batch"
    Promise.all([
      daftarSemua("batch", { perPage: 500, sort: "nomor_batch", expand: "obat" }),
      ambilItemSO(soId),
      daftarSemua("daftar_obat", { perPage: 500, sort: "kode" }),
      ambilCutoffSO(soId)
    ]).then(function (h) {
      return bangunBatchTanpa(h[3], h[2].items, h[1].items).then(function (tanpa) {
        h.push(tanpa);
        return h;
      });
    }).then(function (hasil) {
      var semuaBatch = hasil[0].items.concat(hasil[4]); // batch nyata + baris virtual "Tanpa batch"
      var soItems    = hasil[1].items;
      // Obat aktif yang dikelola per batch tapi belum punya batch: tetap tampil (dengan tombol + Batch)
      var semuaObat  = hasil[2].items.filter(function (o) { return o.pakai_batch === true; }); // nonaktif disembunyikan lewat checkbox

      // Index: batchId (atau "tb:<obatId>") → stockopname_item
      var itemIndex = {};
      soItems.forEach(function (si) { itemIndex[kunciItemSO(si)] = si; });

      // _stok_sistem: pakai stok_cutoff dari SO kalau sudah ada, fallback ke stok_sistem live
      // (baris "Tanpa batch" sudah punya _stok_sistem hasil hitung mutasi s.d. cutoff)
      semuaBatch.forEach(function (b) {
        if (b._tanpa) return;
        var si = itemIndex[b.id];
        if (si && si.stok_cutoff !== null && si.stok_cutoff !== undefined && si.stok_cutoff !== "") {
          b._stok_sistem = Number(si.stok_cutoff);
        } else {
          b._stok_sistem = (b.stok_sistem !== null && b.stok_sistem !== undefined) ? b.stok_sistem : (b.stok_awal || 0);
        }
      });

      // Kelompokkan batch per obat (hanya yang belum ED)
      var obatMap = {}; // obatId → { obat, batch[] }
      semuaBatch.forEach(function (b) {
        if (edLewat(b.expired_date)) return;
        var obat = (b.expand && (b.expand.obat || b.expand.daftar_obat)) || {};
        var obatId = b.obat || obat.id;
        if (!obatId) return;
        if (!obatMap[obatId]) obatMap[obatId] = { obat: obat, batch: [] };
        obatMap[obatId].batch.push(b);
      });

      // Tambahkan obat yang ada di daftar_obat tapi belum punya batch aktif
      semuaObat.forEach(function (o) {
        if (!obatMap[o.id]) obatMap[o.id] = { obat: o, batch: [] };
      });

      // Urutkan obat berdasarkan kode LPLPO
      var daftarObatUrut = Object.keys(obatMap).map(function (id) {
        return obatMap[id];
      }).sort(function (a, b) {
        var ua = urutObatKode(a.obat.kode), ub = urutObatKode(b.obat.kode);
        if (ua[0] !== ub[0]) return ua[0] - ub[0];
        if (ua[2] < ub[2]) return -1;
        if (ua[2] > ub[2]) return 1;
        return 0;
      });

      area.textContent = "";

      if (!daftarObatUrut.length) {
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Belum ada data obat.")
        ]));
        return;
      }

      var tersembunyi = semuaBatch.filter(function (b) { return edLewat(b.expired_date); }).length;
      if (tersembunyi > 0) {
        area.appendChild(el("p", { class: "status-koneksi" },
          tersembunyi + " batch ED lewat tidak ditampilkan; dianggap fisik 0 di tab Penyesuaian."));
      }

      // Map global: batchId → {inp, state} untuk navigasi Enter
      var inputMap = {};
      var totalBatch = 0;
      var panelList = []; // { panel, baris:[{tr,status}] } untuk filter

      // Bilah filter: Semua / Belum dihitung / Ditandai
      var tandaSO = bacaTandaSO(soId);
      var filterAktif = "semua";
      var kataCari = "";
      var tampilNonaktif = false;
      var infoIsi = el("p", { class: "status-koneksi" }, "");

      // Bilah cari + checkbox "tampilkan nonaktif"
      var inpCari = el("input", { type: "search", class: "stok-cari", placeholder: "Cari nama, kode, atau alias obat…", "aria-label": "Cari obat" });
      inpCari.addEventListener("input", function () { kataCari = inpCari.value.trim().toLowerCase(); terapkanFilter(); perbaruiInfo(); });
      var cbNonaktif = el("input", { type: "checkbox", id: "so-cb-nonaktif" });
      cbNonaktif.addEventListener("change", function () { tampilNonaktif = cbNonaktif.checked; terapkanFilter(); perbaruiInfo(); });
      area.appendChild(el("div", { class: "so-bar-cari" }, [
        inpCari,
        el("label", { class: "so-cb-nonaktif", for: "so-cb-nonaktif" }, [cbNonaktif, document.createTextNode(" Tampilkan nonaktif")])
      ]));
      var tombolFilter = {};
      var barFilter = el("div", { class: "ks-filter-bar" });
      [["semua", "Semua"], ["belum", "Belum dihitung"], ["tanda", "Ditandai"]].forEach(function (f) {
        var t = el("button", { type: "button", class: "ks-filter-btn" + (f[0] === "semua" ? " ks-filter-aktif" : "") }, f[1]);
        t.addEventListener("click", function () {
          filterAktif = f[0];
          Object.keys(tombolFilter).forEach(function (k) {
            tombolFilter[k].className = "ks-filter-btn" + (k === filterAktif ? " ks-filter-aktif" : "");
          });
          terapkanFilter();
        });
        tombolFilter[f[0]] = t;
        barFilter.appendChild(t);
      });
      area.appendChild(barFilter);

      function perbaruiInfo() {
        var ids = Object.keys(inputMap).filter(function (k) {
          return (tampilNonaktif || inputMap[k].aktif) && !inputMap[k].ref.ciut; // panel diciutkan tidak dihitung
        }), diisi = 0, tanda = 0;
        ids.forEach(function (k) {
          if (inputMap[k].inp.value !== "") diisi++;
        });
        tanda = panelList.filter(function (p) { return p.ref.tanda && (tampilNonaktif || p.aktif); }).length;
        var belum = ids.length - diisi;
        var jmlCiut = panelList.filter(function (p) { return p.ref.ciut && (tampilNonaktif || p.aktif); }).length;
        infoIsi.textContent = diisi + " dari " + ids.length + " batch sudah diisi · " + belum + " belum dihitung · " + tanda + " obat ditandai" +
          (jmlCiut ? " · " + jmlCiut + " obat stok nol diciutkan." : ".");
        tombolFilter.belum.textContent = "Belum dihitung (" + belum + ")";
        tombolFilter.tanda.textContent = "Ditandai (" + tanda + " obat)";
      }
      function terapkanFilter() {
        panelList.forEach(function (p) {
          var tampil = 0;
          p.baris.forEach(function (r) {
            var ok = r.cocok(filterAktif);
            r.tr.hidden = !ok;
            if (ok) tampil++;
          });
          var cocokAktif = tampilNonaktif || p.aktif;
          var cocokCari = !kataCari || p.teks.indexOf(kataCari) !== -1;
          // Hasil pencarian otomatis dibuka walau stok nol
          if (kataCari && cocokCari && cocokAktif && p.ref.ciut) p.atur(false);
          var sembunyiFilter = filterAktif === "tanda" ? !p.ref.tanda
            : (filterAktif !== "semua" && (tampil === 0 || p.ref.ciut));
          p.panel.hidden = !cocokAktif || !cocokCari || sembunyiFilter;
        });
      }

      daftarObatUrut.forEach(function (grup) {
        var obat = grup.obat;
        var barisPanel = [];
        var batchList = grup.batch.sort(function (a, b) {
          if (!!a._tanpa !== !!b._tanpa) return a._tanpa ? 1 : -1; // "Tanpa batch" selalu paling bawah
          return (a.nomor_batch || "").localeCompare(b.nomor_batch || "");
        });
        var adaBarisTanpa = batchList.some(function (b) { return b._tanpa; });

        // Obat yang bisa diciutkan: semua batch stok sistem 0 (atau tanpa batch), belum ada yang diisi / ditandai
        var bisaCiut = !tandaSO[obat.id] && !batchList.some(function (b) { return itemIndex[b.id]; }) &&
          batchList.every(function (b) { return (Number(b._stok_sistem) || 0) === 0; });
        var kunciBuka = soId + ":" + obat.id;
        var ref = { ciut: bisaCiut && !soBukaManual[kunciBuka], tanda: !!tandaSO[obat.id] };

        // Panel per obat
        var panel = el("div", { class: "so-grup-obat panel" });

        // Header: nama obat + tombol tambah batch
        var tombolTambah = el("button", {
          type: "button", class: "so-btn-tambah-batch btn btn-garis",
          title: "Tambah batch untuk " + (obat.nama_utama || "")
        }, "+ Batch");
        tombolTambah.addEventListener("click", function () {
          bukaTambahBatch(area, soId, obat, function () { tahapHitung(area, soId, lblStatus); });
        });

        var aksiHeader = [tombolTambah];
        if (!adaBarisTanpa) {
          // Obat ini belum punya baris "Tanpa batch": tawarkan untuk menghitung stok fisik tanpa batch
          var tombolTanpa = el("button", {
            type: "button", class: "so-btn-tambah-batch btn btn-garis",
            title: "Hitung stok fisik tanpa batch untuk " + (obat.nama_utama || "")
          }, "+ Tanpa batch");
          tombolTanpa.addEventListener("click", function () {
            var v = window.prompt("Jumlah fisik TANPA batch untuk " + (obat.nama_utama || "obat ini") + ":");
            if (v === null || v === "" || isNaN(Number(v))) return;
            tombolTanpa.disabled = true;
            simpanItemSO(soId, idBatchTanpa(obat.id), obat.id, Number(v), null).then(function () {
              tahapHitung(area, soId, lblStatus);
            }, function () { tombolTanpa.disabled = false; });
          });
          aksiHeader.unshift(tombolTanpa);
        }

        var tombolBuka = el("button", { type: "button", class: "so-btn-buka", "aria-label": "Buka / ciutkan " + (obat.nama_utama || "") }, "▸");
        tombolBuka.hidden = !bisaCiut;
        var ringkasCiut = el("span", { class: "pudar so-ciut-ringkas" },
          batchList.length ? "stok 0 · " + batchList.length + " batch" : "tidak ada batch aktif");
        var spanNama = el("span", { class: "so-grup-nama" }, (obat.kode ? obat.kode + " · " : "") + (obat.nama_utama || obat.id) + (obat.aktif === false ? " (nonaktif)" : ""));
        var spanAksi = el("span", { class: "so-grup-aksi" }, aksiHeader);
        // Tanda "hitung nanti" per obat (ikon kecil, tersimpan di localStorage perangkat ini)
        var tombolTandaObat = el("button", { type: "button", class: "so-btn-tanda", "aria-label": "Tandai obat: hitung nanti", title: "Tandai: hitung nanti" }, "⚑");
        var kepalaGrup = el("div", { class: "so-grup-header" }, [
          el("span", { class: "so-grup-kiri" }, [tombolBuka, spanNama, ringkasCiut, tombolTandaObat]),
          spanAksi
        ]);
        panel.appendChild(kepalaGrup);
        var isiGrup = el("div", { class: "so-grup-isi" });
        panel.appendChild(isiGrup);

        function aturCiut(ciut) {
          ref.ciut = ciut;
          if (ciut) delete soBukaManual[kunciBuka]; else if (bisaCiut) soBukaManual[kunciBuka] = true;
          panel.className = "so-grup-obat panel" + (ref.ciut ? " so-ciut" : "") + (ref.tanda ? " so-ditandai-obat" : "");
          tombolTandaObat.className = "so-btn-tanda" + (ref.tanda ? " aktif" : "");
          tombolTandaObat.setAttribute("aria-pressed", ref.tanda ? "true" : "false");
          isiGrup.hidden = ref.ciut;
          spanAksi.hidden = ref.ciut;
          ringkasCiut.hidden = !ref.ciut;
          tombolBuka.textContent = ref.ciut ? "▸" : "▾";
          tombolBuka.setAttribute("aria-expanded", ref.ciut ? "false" : "true");
        }
        aturCiut(ref.ciut);
        tombolTandaObat.addEventListener("click", function () {
          ref.tanda = !ref.tanda;
          if (ref.tanda) tandaSO[obat.id] = 1; else delete tandaSO[obat.id];
          simpanTandaSO(soId, tandaSO);
          aturCiut(ref.tanda ? false : ref.ciut); // obat yang ditandai selalu terbuka
          perbaruiInfo(); terapkanFilter();
        });
        if (bisaCiut) {
          var gantiCiut = function () { aturCiut(!ref.ciut); perbaruiInfo(); terapkanFilter(); };
          tombolBuka.addEventListener("click", gantiCiut);
          spanNama.addEventListener("click", gantiCiut);
          spanNama.style.cursor = "pointer";
        }

        if (!batchList.length) {
          // Obat tanpa batch — tampilkan baris kosong sebagai petunjuk
          isiGrup.appendChild(el("p", { class: "so-no-batch pudar" }, "Belum ada batch. Gunakan + Batch untuk menambah."));
          panelList.push({ panel: panel, baris: [], aktif: obat.aktif !== false, teks: teksCariObat(obat), ref: ref, atur: aturCiut });
          area.appendChild(panel);
          return;
        }

        // Tabel batch dalam panel
        var kepala = el("thead", {}, [el("tr", {}, [
          el("th", {}, "No. batch"),
          el("th", {}, "ED"),
          el("th", { class: "n" }, "Stok\nsistem"),
          el("th", { class: "n so-th-fisik" }, "Jumlah\nfisik")
        ])]);

        var badan = el("tbody");

        batchList.forEach(function (b) {
          var siItem = itemIndex[b.id];
          var nilaiSimpan = siItem ? siItem.stok_fisik : "";

          var indikator = el("span", {
            class: "so-ind" + (siItem ? " so-ind-ok" : ""),
            title: siItem ? "tersimpan" : "belum disimpan",
            "aria-hidden": "true"
          }, "");

          var inp = el("input", {
            type: "number", min: "0", step: "1",
            class: "inp-fisik", "data-id": b.id,
            value: nilaiSimpan !== "" && nilaiSimpan !== null && nilaiSimpan !== undefined ? String(nilaiSimpan) : "",
            inputmode: "numeric",
            "aria-label": "Jumlah fisik batch " + (b.nomor_batch || "tanpa nomor")
          });

          var state = { itemId: siItem ? siItem.id : null, saving: false };
          inputMap[b.id] = { inp: inp, state: state, aktif: obat.aktif !== false, ref: ref };
          totalBatch++;

          var tr = null;

          function simpan() {
            var v = inp.value;
            if (v === "" || isNaN(Number(v))) return;
            if (state.saving) return;
            state.saving = true;
            indikator.className = "so-ind so-ind-loading";
            indikator.title = "menyimpan...";
            simpanItemSO(soId, b.id, obat.id, Number(v), state.itemId).then(function (rec) {
              state.itemId = rec.id;
              state.saving = false;
              indikator.className = "so-ind so-ind-ok";
              indikator.title = "tersimpan";
              perbaruiInfo();
            }, function () {
              state.saving = false;
              indikator.className = "so-ind so-ind-err";
              indikator.title = "gagal simpan";
            });
          }

          inp.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
              e.preventDefault();
              var kunci = Object.keys(inputMap);
              var posisi = kunci.indexOf(b.id);
              if (posisi < kunci.length - 1) {
                inputMap[kunci[posisi + 1]].inp.focus();
                inputMap[kunci[posisi + 1]].inp.select();
              }
              simpan();
            }
          });
          inp.addEventListener("blur", simpan);

          // Edit no. batch & ED inline
          var spanBatchTeks = el("span", {}, b.nomor_batch || "—");
          var spanEDTeks    = el("span", {}, formatED(b.expired_date));
          var tombolEBatch  = el("button", { type: "button", class: "so-btn-edit-inline", title: "Edit", "aria-label": "Edit batch" }, "✏");
          var inpBatchEdit  = el("input", { type: "text", class: "so-inp-tabel so-inp-batch-edit", value: b.nomor_batch || "", placeholder: "No. batch", hidden: true, style: "text-transform:uppercase" });
          var edValEdit     = b.expired_date ? b.expired_date.slice(0, 7) : "";
          var inpEDEdit     = el("input", { type: "month", class: "so-inp-tabel", value: edValEdit, hidden: true });
          var tombolSimpEB  = el("button", { type: "button", class: "btn btn-garis so-btn-simpan-ed", hidden: true }, "✓");
          var tombolBatalEB = el("button", { type: "button", class: "so-btn-edit-inline", hidden: true, title: "Batal" }, "✕");
          var indEB         = el("span", { class: "so-ind", "aria-hidden": "true" }, "");

          inpBatchEdit.addEventListener("input", function () { inpBatchEdit.value = inpBatchEdit.value.toUpperCase(); });

          function bukaEditB() {
            spanBatchTeks.hidden = true; tombolEBatch.hidden = true;
            inpBatchEdit.hidden = false; inpEDEdit.hidden = false;
            tombolSimpEB.hidden = false; tombolBatalEB.hidden = false;
            inpBatchEdit.focus();
          }
          function tutupEditB() {
            spanBatchTeks.hidden = false; tombolEBatch.hidden = false;
            inpBatchEdit.hidden = true; inpEDEdit.hidden = true;
            tombolSimpEB.hidden = true; tombolBatalEB.hidden = true;
          }
          tombolEBatch.addEventListener("click", bukaEditB);
          tombolBatalEB.addEventListener("click", tutupEditB);
          tombolSimpEB.addEventListener("click", function () {
            var noBaru = inpBatchEdit.value.trim().toUpperCase();
            var edBaru = inpEDEdit.value ? inpEDEdit.value + "-01" : "";
            indEB.className = "so-ind so-ind-loading";
            LPLPO.ubah("batch", b.id, { nomor_batch: noBaru, expired_date: edBaru }).then(function () {
              b.nomor_batch = noBaru; b.expired_date = edBaru;
              spanBatchTeks.textContent = noBaru || "—";
              spanEDTeks.textContent = formatED(edBaru);
              indEB.className = "so-ind so-ind-ok";
              tutupEditB();
            }, function () { indEB.className = "so-ind so-ind-err"; });
          });

          var edBulanIni = false;
          if (b.expired_date) {
            var d2 = new Date(b.expired_date);
            var skrg = new Date();
            edBulanIni = d2.getFullYear() === skrg.getFullYear() && d2.getMonth() === skrg.getMonth();
          }

          // Baris "Tanpa batch": bukan record batch, jadi tidak ada edit nomor/ED
          var selBatch = b._tanpa
            ? el("td", { "data-label": "No. batch" }, [el("em", { class: "pudar" }, "Tanpa batch")])
            : el("td", { "data-label": "No. batch" }, [spanBatchTeks, tombolEBatch, inpBatchEdit, indEB]);
          var selED = b._tanpa
            ? el("td", { "data-label": "ED" }, [el("span", { class: "pudar" }, "—")])
            : el("td", { "data-label": "ED" }, [spanEDTeks, inpEDEdit, tombolSimpEB, tombolBatalEB]);

          tr = el("tr", { class: edBulanIni ? "terpilih" : "" }, [
            selBatch,
            selED,
            el("td", { class: "n", "data-label": "Stok sistem" },
              b._stok_sistem !== undefined ? String(b._stok_sistem) : "-"),
            el("td", { class: "n so-td-fisik", "data-label": "Jumlah fisik" }, [inp, indikator])
          ]);
          barisPanel.push({ tr: tr, cocok: function (f) {
            return f === "semua" || (f === "belum" && inp.value === "") || (f === "tanda" && ref.tanda);
          } });
          badan.appendChild(tr);
        });

        isiGrup.appendChild(el("div", { class: "tabel-gulir" }, [
          el("table", { class: "so-tabel-batch" }, [kepala, badan])
        ]));
        panelList.push({ panel: panel, baris: barisPanel, aktif: obat.aktif !== false, teks: teksCariObat(obat), ref: ref, atur: aturCiut });
        area.appendChild(panel);
      });

      terapkanFilter();
      perbaruiInfo();
      area.appendChild(infoIsi);

      var tombolLanjut = el("button", { type: "button", class: "btn btn-utama" }, "Lihat selisih →");
      tombolLanjut.addEventListener("click", function () { location.hash = "#/stockopname/sesuaikan"; });
      area.appendChild(el("div", { class: "bilah-simpan" }, [tombolLanjut]));

    }, function (err) {
      tanganiGalat(err, function () { tahapHitung(area, soId, lblStatus); }, area);
    });
  }

  // obatPreset: object {id, nama_utama} opsional — kalau diisi, field obat langsung terpilih & readonly
  function bukaTambahBatch(areaSO, soId, obatPreset, onSelesai) {
    // Backward compat: bukaTambahBatch(area, soId, callback)
    if (typeof obatPreset === "function") { onSelesai = obatPreset; obatPreset = null; }

    var overlay = el("div", { class: "modal-overlay" });
    var kotak = el("div", { class: "modal-kotak panel modal-kotak-scroll" });
    overlay.appendChild(kotak);
    document.body.appendChild(overlay);

    function tutup() { document.body.removeChild(overlay); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) tutup(); });

    var judulModal = obatPreset
      ? "Tambah Batch · " + (obatPreset.nama_utama || obatPreset.id)
      : "Tambah Batch Baru";
    kotak.appendChild(el("h3", { style: "margin-top:0" }, judulModal));

    // Kalau obat sudah diketahui, tidak perlu load daftar obat
    if (obatPreset && obatPreset.id) {
      _isiFormTambahBatch(kotak, soId, obatPreset, tutup, onSelesai);
      return;
    }

    kotak.appendChild(el("p", { class: "status-koneksi" }, "Memuat daftar obat..."));

    LPLPO.daftar("daftar_obat", { perPage: 500, sort: "kode", filter: "aktif=true && pakai_batch=true", expand: "kategori" })
      .then(function (dObat) {
        kotak.textContent = "";
        kotak.appendChild(el("h3", { style: "margin-top:0" }, judulModal));

        var obatList = dObat.items;
        var state = { obatId: "", obatNama: "" };

        var cariObat = buatCariObat(obatList, function (o) {
          state.obatId = o.id;
          state.obatNama = o.nama_utama;
          inpNamaObat.value = o.nama_utama;
          inpNamaObat.dataset.id = o.id;
        });
        var inpNamaObat = cariObat.querySelector("input");
        inpNamaObat.placeholder = "Ketik nama obat...";

        var inpBatch = el("input", { type: "text", class: "inp-teks", placeholder: "Nomor batch (kosongkan jika tidak ada)", style: "text-transform:uppercase" });
        inpBatch.addEventListener("input", function () { inpBatch.value = inpBatch.value.toUpperCase(); });
        var inpED = el("input", { type: "month", class: "inp-teks" });
        var inpJumlah = el("input", { type: "number", class: "inp-teks", min: "0", step: "1", placeholder: "Jumlah fisik saat ini" });

        var pesanForm = el("p", { class: "pesan", hidden: true });
        var tombolSimpanBatch = el("button", { type: "button", class: "btn btn-utama" }, "Simpan batch");
        var tombolBatal = el("button", { type: "button", class: "btn btn-garis" }, "Batal");
        tombolBatal.addEventListener("click", tutup);

        tombolSimpanBatch.addEventListener("click", function () {
          var obatId = inpNamaObat.dataset && inpNamaObat.dataset.id;
          var jumlah = inpJumlah.value;
          if (!obatId) { pesanForm.textContent = "Pilih obat terlebih dahulu."; pesanForm.className = "pesan galat"; pesanForm.hidden = false; return; }
          if (jumlah === "" || isNaN(Number(jumlah))) { pesanForm.textContent = "Isi jumlah fisik."; pesanForm.className = "pesan galat"; pesanForm.hidden = false; return; }

          tombolSimpanBatch.disabled = true;
          tombolSimpanBatch.textContent = "Menyimpan...";

          var edVal = inpED.value ? inpED.value + "-01" : "";

          LPLPO.buat("batch", {
            obat: obatId,
            nomor_batch: inpBatch.value.trim(),
            expired_date: edVal,
            stok_awal: 0,
            aktif: true
          }).then(function (rec) {
            // Langsung buat item SO untuk batch baru ini
            return simpanItemSO(soId, rec.id, obatId, Number(jumlah), null).then(function () {
              tutup();
              onSelesai();
            });
          }, function (err) {
            tombolSimpanBatch.disabled = false;
            tombolSimpanBatch.textContent = "Simpan batch";
            pesanForm.textContent = "Gagal menyimpan: " + (err && err.message ? err.message : String(err));
            pesanForm.className = "pesan galat";
            pesanForm.hidden = false;
          });
        });

        var isiModal = el("div", { class: "modal-isi" }, [
          el("div", { class: "field" }, [el("label", { class: "field-label" }, "Nama obat"), cariObat]),
          el("div", { class: "field" }, [el("label", { class: "field-label" }, "Nomor batch"), inpBatch]),
          el("div", { class: "field" }, [el("label", { class: "field-label" }, "Expired date"), inpED]),
          el("div", { class: "field" }, [el("label", { class: "field-label" }, "Jumlah fisik"), inpJumlah]),
          pesanForm
        ]);
        var tombolModal = el("div", { class: "modal-tombol" }, [tombolBatal, tombolSimpanBatch]);
        kotak.appendChild(isiModal);
        kotak.appendChild(tombolModal);
      }, function () {
        kotak.textContent = "";
        kotak.appendChild(el("p", {}, "Gagal memuat daftar obat."));
      });
  }

  // Helper: isi form tambah batch dengan obat sudah diketahui (dari tombol di panel obat)
  function _isiFormTambahBatch(kotak, soId, obat, tutup, onSelesai) {
    var inpBatch = el("input", { type: "text", class: "inp-teks", placeholder: "Nomor batch (kosongkan jika tidak ada)", style: "text-transform:uppercase" });
    inpBatch.addEventListener("input", function () { inpBatch.value = inpBatch.value.toUpperCase(); });
    var inpED = el("input", { type: "month", class: "inp-teks" });
    var inpJumlah = el("input", { type: "number", class: "inp-teks", min: "0", step: "1", placeholder: "Jumlah fisik saat ini" });

    var pesanForm = el("p", { class: "pesan", hidden: true });
    var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan batch");
    var tombolBatal  = el("button", { type: "button", class: "btn btn-garis" }, "Batal");
    tombolBatal.addEventListener("click", tutup);

    tombolSimpan.addEventListener("click", function () {
      var jumlah = inpJumlah.value;
      if (jumlah === "" || isNaN(Number(jumlah))) {
        pesanForm.textContent = "Isi jumlah fisik.";
        pesanForm.className = "pesan galat"; pesanForm.hidden = false; return;
      }
      tombolSimpan.disabled = true; tombolSimpan.textContent = "Menyimpan...";
      var edVal = inpED.value ? inpED.value + "-01" : "";
      LPLPO.buat("batch", {
        obat: obat.id,
        nomor_batch: inpBatch.value.trim(),
        expired_date: edVal,
        stok_awal: 0,
        aktif: true
      }).then(function (rec) {
        return simpanItemSO(soId, rec.id, obat.id, Number(jumlah), null).then(function () {
          tutup(); onSelesai();
        });
      }, function (err) {
        tombolSimpan.disabled = false; tombolSimpan.textContent = "Simpan batch";
        pesanForm.textContent = "Gagal: " + (err && err.message ? err.message : String(err));
        pesanForm.className = "pesan galat"; pesanForm.hidden = false;
      });
    });

    var isiModal = el("div", { class: "modal-isi" }, [
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Nomor batch"), inpBatch]),
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Expired date"), inpED]),
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Jumlah fisik"), inpJumlah]),
      pesanForm
    ]);
    kotak.appendChild(isiModal);
    kotak.appendChild(el("div", { class: "modal-tombol" }, [tombolBatal, tombolSimpan]));
    inpBatch.focus();
  }

  // Recalc semua stok_cutoff untuk semua batch dalam satu SO
  // Fetch mutasi semua obat ter-cutoff, hitung, simpan ke stockopname_item.stok_cutoff
  function jalankanRecalcSOSemua(soId, semuaBatch, soItems, itemIndex, progEl, selesai) {
    function prog(t) { progEl.textContent = t; }

    // Ambil soTanggal dari PocketBase dulu
    prog("Memuat periode SO...");
    LPLPO.daftar("stockopname", { filter: 'id = "' + soId + '"', perPage: 1 }).then(function (d) {
      var so = (d.items && d.items[0]) || {};
      var soTanggal = so.tanggal || "";

      // Hitung cutoff (akhir bulan SO)
      var cutoff = (function (tgl) {
        if (!tgl) return new Date().toISOString().slice(0, 10);
        var parts = tgl.slice(0, 10).split("-");
        var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1;
        var akhir = new Date(y, m + 1, 0);
        return akhir.getFullYear() + "-" + String(akhir.getMonth() + 1).padStart(2, "0") + "-" + String(akhir.getDate()).padStart(2, "0") + " 23:59:59";
      })(soTanggal);

      // Kelompokkan batch per obat
      var obatBatch = {}; // obatId → [batch]
      semuaBatch.forEach(function (bt) {
        if (bt._tanpa) return; // "Tanpa batch" dihitung langsung dari mutasi, tidak perlu disimpan
        var obatId = bt.obat || bt.daftar_obat;
        if (!obatId) return;
        if (!obatBatch[obatId]) obatBatch[obatId] = [];
        obatBatch[obatId].push(bt);
      });

      var obatIds = Object.keys(obatBatch);
      var total = obatIds.length;
      var selesaiN = 0;
      prog("0 / " + total + " obat...");

      // Proses satu obat: fetch mutasi ter-cutoff, hitung, simpan stok_cutoff
      function prosesObat(obatId) {
        var batchList = obatBatch[obatId];
        return daftarSemua("mutasi", {
          perPage: 500, sort: "tanggal,id",
          filter: 'obat = "' + obatId + '" && tanggal <= "' + cutoff + '"'
        }).then(function (dm) {
          var txList = dm.items || [];
          var sisaBatch = {};
          batchList.forEach(function (bt) { sisaBatch[bt.id] = Number(bt.stok_awal) || 0; });
          txList.forEach(function (tx) {
            if (!tx.batch) return;
            if (!(tx.batch in sisaBatch)) sisaBatch[tx.batch] = 0;
            var j = Number(tx.jumlah) || 0;
            if (tx.jenis === "masuk") sisaBatch[tx.batch] += j;
            else sisaBatch[tx.batch] -= j;
          });

          // Simpan stok_cutoff hanya ke item SO yang sudah ada (batch yang sudah dihitung fisiknya).
          // Tidak membuat item baru: PocketBase v0.22 menyimpan angka kosong sebagai 0, sehingga
          // item buatan recalc akan terbaca sebagai "fisik = 0" padahal belum dihitung.
          var patches = [];
          batchList.forEach(function (bt) {
            var cutoffVal = sisaBatch[bt.id] !== undefined ? sisaBatch[bt.id] : 0;
            var si = itemIndex[bt.id];
            if (si) {
              patches.push(LPLPO.ubah("stockopname_item", si.id, { stok_cutoff: cutoffVal }).then(function () {
                si.stok_cutoff = cutoffVal;
                bt._stok_sistem = cutoffVal;
              }));
            }
          });
          return Promise.all(patches);
        }).then(function () {
          selesaiN++;
          prog(selesaiN + " / " + total + " obat...");
        });
      }

      return antrianSeri(obatIds.map(function (id) { return function () { return prosesObat(id); }; }));
    }).then(function () {
      progEl.textContent = "Selesai.";
      setTimeout(function () { progEl.textContent = ""; }, 3000);
      selesai();
    }, function (err) {
      progEl.textContent = "Error: " + (err.pesan || err.message || "Gagal recalc.");
      selesai();
    });
  }

  // Cek obat yang stok_cutoff-nya sudah usang: ada mutasi bertanggal <= cutoff yang dicatat/diubah
  // setelah item SO obat itu terakhir diperbarui. Kandidat dari satu query, lalu dihitung ulang
  // per obat dan dibandingkan dengan stok_cutoff tersimpan (hanya yang benar-benar beda yang dilaporkan).
  // Catatan: mutasi yang dihapus tidak terdeteksi (recordnya sudah hilang).
  function cekPerluSinkronSO(cutoff, semuaBatch, soItems) {
    var minUpd = {}, gmin = "";
    soItems.forEach(function (si) {
      if (!si.batch || !si.updated) return;
      if (!minUpd[si.obat] || si.updated < minUpd[si.obat]) minUpd[si.obat] = si.updated;
      if (!gmin || si.updated < gmin) gmin = si.updated;
    });
    if (!gmin) return Promise.resolve([]);

    return daftarSemua("mutasi", {
      perPage: 500, fields: "id,obat,updated",
      filter: 'tanggal <= "' + cutoff + '" && updated > "' + gmin + '"'
    }).then(function (dm) {
      var kandidat = {};
      dm.items.forEach(function (tx) {
        if (minUpd[tx.obat] && tx.updated > minUpd[tx.obat]) kandidat[tx.obat] = true;
      });
      var hasil = [];
      var ids = Object.keys(kandidat);
      return antrianSeri(ids.map(function (obatId) {
        return function () {
          var batchObat = semuaBatch.filter(function (bt) { return !bt._tanpa && (bt.obat || bt.daftar_obat) === obatId; });
          return daftarSemua("mutasi", {
            perPage: 500, sort: "tanggal,id",
            filter: 'obat = "' + obatId + '" && tanggal <= "' + cutoff + '"'
          }).then(function (dt) {
            var sisa = {};
            batchObat.forEach(function (bt) { sisa[bt.id] = Number(bt.stok_awal) || 0; });
            dt.items.forEach(function (tx) {
              if (!tx.batch) return;
              if (!(tx.batch in sisa)) sisa[tx.batch] = 0;
              sisa[tx.batch] += (tx.jenis === "masuk" ? 1 : -1) * (Number(tx.jumlah) || 0);
            });
            var perubahan = [];
            soItems.forEach(function (si) {
              if (!si.batch || si.obat !== obatId) return;
              var baru = sisa[si.batch] !== undefined ? sisa[si.batch] : 0;
              var lama = Number(si.stok_cutoff) || 0;
              if (baru !== lama) {
                var bt = batchObat.filter(function (x) { return x.id === si.batch; })[0];
                perubahan.push({ si: si, lama: lama, baru: baru, label: bt ? labelBatch(bt) : "batch" });
              }
            });
            if (perubahan.length) hasil.push({ obatId: obatId, perubahan: perubahan });
          });
        };
      })).then(function () { return hasil; });
    });
  }

  // Cek obat yang stok fisiknya sudah dihitung, tetapi setelah hari hitung (tanggal created item SO
  // paling awal obat itu) masih ada mutasi bertanggal <= cutoff. Fisiknya belum memuat mutasi itu.
  // Mutasi yang dihapus tidak terdeteksi.
  function cekFisikPerluDicek(cutoff, soItems) {
    var hariHitung = {}, gmin = "";
    soItems.forEach(function (si) {
      if (!si.created) return;
      var h = si.created.slice(0, 10);
      if (!hariHitung[si.obat] || h < hariHitung[si.obat]) hariHitung[si.obat] = h;
      if (!gmin || h < gmin) gmin = h;
    });
    if (!gmin) return Promise.resolve([]);
    return daftarSemua("mutasi", {
      perPage: 500, sort: "tanggal,id", expand: "unit",
      filter: 'tanggal > "' + gmin + ' 23:59:59" && tanggal <= "' + cutoff + '"'
    }).then(function (dm) {
      var perObat = {};
      dm.items.forEach(function (tx) {
        var h = hariHitung[tx.obat];
        if (!h || (tx.tanggal || "").slice(0, 10) <= h) return;
        if (!perObat[tx.obat]) perObat[tx.obat] = [];
        perObat[tx.obat].push(tx);
      });
      return Object.keys(perObat).map(function (id) {
        return { obatId: id, hariHitung: hariHitung[id], mutasi: perObat[id] };
      });
    });
  }

  // tahapSesuaikan: daftar per-item (satu baris = satu obat)
  function tahapSesuaikan(area, soId) {
    area.textContent = "";
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data untuk penyesuaian..."));

    Promise.all([
      daftarSemua("batch", { perPage: 500, sort: "nomor_batch", expand: "obat,daftar_obat" }),
      ambilItemSO(soId),
      daftarSemua("daftar_obat", { perPage: 500, sort: "kode" }),
      ambilCutoffSO(soId)
    ]).then(function (h) {
      return bangunBatchTanpa(h[3], h[2].items, h[1].items).then(function (tanpa) {
        h.push(tanpa);
        return h;
      });
    }).then(function (hasil) {
      var semuaBatch = hasil[0].items.concat(hasil[4]); // batch nyata + baris virtual "Tanpa batch"
      var soItems = hasil[1].items;

      var itemIndex = {};
      soItems.forEach(function (si) { itemIndex[kunciItemSO(si)] = si; });

      if (!soItems.length) {
        area.textContent = "";
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Belum ada data penghitungan. Isi jumlah fisik di tab Penghitungan terlebih dahulu.")
        ]));
        return;
      }

      // _stok_sistem: pakai stok_cutoff dari SO kalau sudah ada, fallback ke stok_sistem live
      // (baris "Tanpa batch" sudah punya _stok_sistem dari hitungan mutasi s.d. cutoff)
      semuaBatch.forEach(function (b) {
        if (b._tanpa) return;
        var si = itemIndex[b.id];
        if (si && si.stok_cutoff !== null && si.stok_cutoff !== undefined && si.stok_cutoff !== "") {
          b._stok_sistem = Number(si.stok_cutoff);
        } else {
          b._stok_sistem = (b.stok_sistem !== null && b.stok_sistem !== undefined) ? b.stok_sistem : (b.stok_awal || 0);
        }
      });

      function fisikDari(b) {
        var si = itemIndex[b.id];
        if (si) return Number(si.stok_fisik);
        if (edLewat(b.expired_date)) return 0;
        return null;
      }

      // Kelompokkan batch per obat, hitung selisih total
      var obatMap = {}; // obatId → { obat, batch[], totalSistem, totalFisik, adaSelisih }
      semuaBatch.forEach(function (b) {
        var obat = (b.expand && (b.expand.obat || b.expand.daftar_obat)) || {};
        var obatId = b.obat || b.daftar_obat || obat.id;
        if (!obatId) return;
        if (!obatMap[obatId]) obatMap[obatId] = { obat: obat, obatId: obatId, batch: [], totalSistem: 0, totalFisik: 0, adaNull: false, belum: 0 };
        var fisik = fisikDari(b);
        obatMap[obatId].batch.push(b);
        // Batch yang belum dihitung tidak ikut perbandingan (sistem maupun fisik)
        if (fisik === null) { obatMap[obatId].adaNull = true; obatMap[obatId].belum++; return; }
        obatMap[obatId].totalSistem += b._stok_sistem;
        obatMap[obatId].totalFisik += fisik;
      });

      var URUT_KAT = ["A","T","B","F","D","C","E","G","H","I","J","K","L","M","V","W","N","O","P","Q","R","S","X","U","Y"];
      function urutObat(kode) {
        if (!kode) return [99, "", ""];
        var bagian = kode.split("-");
        var idx = URUT_KAT.indexOf(bagian[0] || "");
        return [idx === -1 ? 98 : idx, kode];
      }

      // Obat yang sudah dihitung (bukan semua batch belum dihitung / dilewati)
      function urutKode(a, b) {
        var ua = urutObat(a.obat.kode), ub = urutObat(b.obat.kode);
        if (ua[0] !== ub[0]) return ua[0] - ub[0];
        return (ua[1] || "").localeCompare(ub[1] || "");
      }
      var obatTerhitung = Object.keys(obatMap).map(function (id) { return obatMap[id]; })
        .filter(function (item) {
          return !(item.adaNull && item.batch.every(function (b) { return fisikDari(b) === null; }));
        });
      // Selisih: total berbeda, ATAU ada batch (termasuk Tanpa batch) yang berbeda walau total impas
      function adaSelisihItem(item) {
        if (item.totalFisik !== item.totalSistem) return true;
        return item.batch.some(function (b) {
          var f = fisikDari(b);
          return f !== null && f !== b._stok_sistem;
        });
      }
      var daftarItem = obatTerhitung.filter(adaSelisihItem).sort(urutKode);
      var daftarSesuai = obatTerhitung.filter(function (i) { return !adaSelisihItem(i); }).sort(urutKode);

      area.textContent = "";

      if (soPesanTerakhir) {
        area.appendChild(el("p", { class: "pesan info" }, soPesanTerakhir));
        soPesanTerakhir = "";
      }

      // Tombol Recalc semua + progress
      var areaRecalcSemua = el("div", { class: "so-recalc-semua-wrap" });
      var tombolRecalcSemua = el("button", { type: "button", class: "btn btn-hijau" }, "⟳ Sinkronkan semua stok cutoff");
      var progRecalcSemua = el("span", { class: "so-recalc-prog" }, "");
      areaRecalcSemua.appendChild(tombolRecalcSemua);
      areaRecalcSemua.appendChild(progRecalcSemua);
      area.appendChild(areaRecalcSemua);

      tombolRecalcSemua.addEventListener("click", function () {
        tombolRecalcSemua.disabled = true;
        jalankanRecalcSOSemua(soId, semuaBatch, soItems, itemIndex, progRecalcSemua, function () {
          tombolRecalcSemua.disabled = false;
          tahapSesuaikan(area, soId);
        });
      });

      // Banner: obat yang stok cutoff-nya usang karena ada mutasi baru/diubah sebelum cutoff
      var wadahUsang = el("div", {});
      area.appendChild(wadahUsang);
      cekPerluSinkronSO(hasil[3], semuaBatch, soItems).then(function (usang) {
        if (!usang.length) return;
        var namaObat = function (id) { return (obatMap[id] && obatMap[id].obat.nama_utama) || id; };
        var pesanUsang = el("span", { class: "so-recalc-prog" }, "");
        var tombolSemuaUsang = el("button", { type: "button", class: "btn btn-hijau" }, "⟳ Sinkronkan yang berubah saja");
        function terapkan(daftar, tombol) {
          if (tombol) tombol.disabled = true;
          var patches = [];
          daftar.forEach(function (u) {
            u.perubahan.forEach(function (p) {
              patches.push(function () { return LPLPO.ubah("stockopname_item", p.si.id, { stok_cutoff: p.baru }); });
            });
          });
          pesanUsang.textContent = "Menyinkronkan...";
          antrianSeri(patches).then(function () { tahapSesuaikan(area, soId); },
            function (err) {
              pesanUsang.textContent = "Error: " + ((err && (err.pesan || err.message)) || "Gagal.");
              if (tombol) tombol.disabled = false;
            });
        }
        tombolSemuaUsang.addEventListener("click", function () { terapkan(usang, tombolSemuaUsang); });
        var baris = usang.map(function (u) {
          var tombolSatu = el("button", { type: "button", class: "btn btn-garis so-usang-tombol" }, "Sinkronkan");
          tombolSatu.addEventListener("click", function () { terapkan([u], tombolSatu); });
          return el("div", { class: "so-usang-baris" }, [
            el("div", { class: "so-usang-isi" }, [
              el("a", { href: "#/stockopname/item/" + u.obatId, class: "so-usang-nama" }, namaObat(u.obatId)),
              el("div", { class: "so-batch-chips" }, u.perubahan.map(function (p) {
                return el("span", { class: "so-batch-chip" }, p.label + ": " + p.lama + " → " + p.baru);
              }))
            ]),
            tombolSatu
          ]);
        });
        wadahUsang.appendChild(el("section", { class: "panel so-usang" }, [
          el("strong", {}, "⚠ " + usang.length + " obat berubah sejak sinkron terakhir"),
          el("p", { class: "pudar", style: "margin:4px 0 8px; font-size:13px" },
            "Ada mutasi bertanggal sebelum cutoff yang baru dicatat atau diubah, jadi selisih obat ini bisa belum akurat."),
          el("div", { class: "so-recalc-semua-wrap" }, [tombolSemuaUsang, pesanUsang])
        ].concat(baris)));
      }, function () { /* pengecekan gagal: abaikan, tombol sinkron manual tetap ada */ });

      // Banner: fisik sudah dihitung tapi masih ada mutasi setelah hari hitung (sebelum cutoff)
      var wadahFisik = el("div", {});
      area.appendChild(wadahFisik);
      cekFisikPerluDicek(hasil[3], soItems).then(function (perlu) {
        if (!perlu.length) return;
        var baris = perlu.map(function (u) {
          var o = (obatMap[u.obatId] && obatMap[u.obatId].obat) || {};
          return el("div", { class: "so-usang-baris" }, [
            el("div", { class: "so-usang-isi" }, [
              el("a", { href: "#/stockopname/item/" + u.obatId, class: "so-usang-nama" }, o.nama_utama || u.obatId),
              el("div", { class: "pudar", style: "font-size:13px" }, "Dihitung " + formatTglPendek(u.hariHitung)),
              el("ul", { class: "so-usang-mutasi" }, u.mutasi.map(function (tx) {
                var unitNama = (tx.expand && tx.expand.unit && tx.expand.unit.nama) || "-";
                return el("li", {}, formatTglPendek(tx.tanggal) + " · " + (tx.jenis === "masuk" ? "Masuk " : "Keluar ") +
                  formatAngka(Number(tx.jumlah) || 0) + " " + (o.satuan || "") + " · " + unitNama);
              }))
            ])
          ]);
        });
        wadahFisik.appendChild(el("section", { class: "panel so-usang" }, [
          el("strong", {}, "⚠ " + perlu.length + " obat: fisik perlu dicek ulang"),
          el("p", { class: "pudar", style: "margin:4px 0 8px; font-size:13px" },
            "Obat ini sudah dihitung, tetapi masih ada mutasi setelah hari hitung dan sebelum cutoff. Hitung ulang atau pastikan fisiknya sudah termasuk mutasi ini.")
        ].concat(baris)));
      }, function () { /* gagal cek: abaikan */ });

      // Pilihan tampilan: Selisih / Sesuai ✓
      var modeDaftar = "selisih";
      var barMode = el("div", { class: "ks-filter-bar" });
      var tombolMode = {};
      [["selisih", "Selisih (" + daftarItem.length + ")"], ["sesuai", "✓ Sesuai (" + daftarSesuai.length + ")"]].forEach(function (m) {
        var t = el("button", { type: "button", class: "ks-filter-btn" + (m[0] === modeDaftar ? " ks-filter-aktif" : "") }, m[1]);
        t.addEventListener("click", function () {
          modeDaftar = m[0];
          Object.keys(tombolMode).forEach(function (k) {
            tombolMode[k].className = "ks-filter-btn" + (k === modeDaftar ? " ks-filter-aktif" : "");
          });
          gambarDaftar();
        });
        tombolMode[m[0]] = t;
        barMode.appendChild(t);
      });
      area.appendChild(barMode);
      var wadahDaftar = el("div", {});
      area.appendChild(wadahDaftar);

      function gambarDaftar() {
        wadahDaftar.textContent = "";
        if (modeDaftar === "sesuai") {
          if (!daftarSesuai.length) {
            wadahDaftar.appendChild(el("p", { class: "pudar" }, "Belum ada obat yang sesuai. Klik \"Sinkronkan semua stok cutoff\" bila stok sistem belum terbarui."));
            return;
          }
          wadahDaftar.appendChild(el("p", {}, daftarSesuai.length + " obat sudah sesuai:"));
          daftarSesuai.forEach(function (item) {
            wadahDaftar.appendChild(el("a", {
              href: "#/stockopname/item/" + item.obatId, class: "panel so-kartu so-kartu-item"
            }, [
              el("div", { class: "so-kepala" }, [
                el("strong", { class: "so-nama-obat" }, item.obat.nama_utama || item.obatId),
                el("span", { class: "lencana aman" }, "✓ Sesuai")
              ]),
              el("div", { class: "pudar", style: "font-size:13px" },
                "Sistem " + formatAngka(item.totalSistem) + " " + (item.obat.satuan || "") + " = fisik " + formatAngka(item.totalFisik) +
                (item.belum ? " · " + item.belum + " batch belum dihitung" : ""))
            ]));
          });
          return;
        }

        if (!daftarItem.length) {
          wadahDaftar.appendChild(el("section", { class: "panel" }, [
            el("p", { style: "margin:0" }, "Tidak ada selisih. Semua stok yang sudah dihitung cocok dengan stok sistem. 🎉")
          ]));
          return;
        }
        wadahDaftar.appendChild(el("p", {}, daftarItem.length + " obat memiliki selisih:"));

        daftarItem.forEach(function (item) {
          var diff = item.totalFisik - item.totalSistem;
          var diffStr = (diff > 0 ? "+" : "") + diff;
          var diffKelas = diff > 0 ? "lebih" : diff < 0 ? "kurang" : "";
          var satuan = item.obat.satuan || "";

          // Baris batch yang bermasalah
          var batchBermasalah = item.batch.filter(function (b) {
            var fisik = fisikDari(b);
            return fisik !== null && fisik !== b._stok_sistem;
          });
          var batchRows = batchBermasalah.map(function (b) {
            var fisik = fisikDari(b);
            var d = fisik - b._stok_sistem;
            var dStr = (d > 0 ? "+" : "") + d;
            var label = b._tanpa ? "Tanpa batch" : labelBatch(b);
            return el("span", { class: "so-batch-chip " + (d > 0 ? "lebih" : "kurang") }, label + " " + dStr);
          });

          wadahDaftar.appendChild(el("a", {
            href: "#/stockopname/item/" + item.obatId,
            class: "panel so-kartu so-kartu-item"
          }, [
            el("div", { class: "so-kepala" }, [
              el("strong", { class: "so-nama-obat" }, item.obat.nama_utama || item.obatId),
              el("div", { class: "so-selisih-wrap" }, [
                el("span", { class: "so-selisih-val " + diffKelas }, diffStr),
                el("span", { class: "pudar so-satuan" }, " " + satuan)
              ])
            ]),
            batchRows.length ? el("div", { class: "so-batch-chips" }, batchRows) : el("span", {}),
            item.belum ? el("div", { class: "pudar", style: "font-size:12px; margin-top:4px" }, item.belum + " batch belum dihitung (tidak ikut selisih)") : el("span", {}),
            el("div", { class: "so-kartu-lihat pudar" }, "Lihat detail →")
          ]));
        });
      }
      gambarDaftar();

    }, function (err) {
      tanganiGalat(err, function () { tahapSesuaikan(area, soId); }, area);
    });
  }

  // renderDetailItem: halaman detail per obat di tab Penyesuaian
  // soTanggal: "YYYY-MM-DD" akhir bulan SO, dipakai sebagai cutoff mutasi
  function renderDetailItem(area, soId, obatId, soTanggal) {
    area.textContent = "";
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat detail..."));

    // Jika soTanggal belum diketahui, ambil dulu dari PocketBase
    if (!soTanggal) {
      LPLPO.daftar("stockopname", { filter: 'id = "' + soId + '"', perPage: 1 }).then(function (d) {
        var so = (d.items && d.items[0]) || {};
        renderDetailItem(area, soId, obatId, so.tanggal || "9999-12-31");
      });
      return;
    }

    // Hitung akhir bulan dari soTanggal (pakai hari terakhir bulan tsb)
    var cutoff = (function (tgl) {
      var d = new Date(tgl);
      if (isNaN(d)) return tgl;
      var akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return akhir.getFullYear() + "-" + String(akhir.getMonth() + 1).padStart(2, "0") + "-" + String(akhir.getDate()).padStart(2, "0") + " 23:59:59";
    })(soTanggal);

    var filterMutasi = 'obat = "' + obatId + '" && status = "confirmed" && tanggal <= "' + cutoff + '"';

    Promise.all([
      LPLPO.daftar("daftar_obat", { filter: 'id = "' + obatId + '"', perPage: 1 }),
      daftarSemua("batch", { perPage: 200, filter: 'obat = "' + obatId + '"', sort: "nomor_batch" }),
      daftarSemua("mutasi", { perPage: 500, filter: filterMutasi, sort: "tanggal,id", expand: "unit,batch" }),
      ambilItemSO(soId)
    ]).then(function (hasil) {
      var obat = (hasil[0].items && hasil[0].items[0]) || {};
      var batchObat = hasil[1].items;
      var semuaTx = hasil[2].items;
      var soItems = hasil[3].items;

      // Urutkan batch untuk semua pemilih batch di halaman ini: tanggal mutasi pertama paling awal dulu,
      // lalu batch tanpa mutasi (sampai cutoff) berdasarkan ED terdekat. Sebelumnya urut nomor batch.
      (function () {
        var tglPertama = {};
        semuaTx.forEach(function (tx) {
          if (!tx.batch || !tx.tanggal) return;
          if (!tglPertama[tx.batch] || tx.tanggal < tglPertama[tx.batch]) tglPertama[tx.batch] = tx.tanggal;
        });
        batchObat.sort(function (a, b) {
          var ta = tglPertama[a.id] || "", tb = tglPertama[b.id] || "";
          if (!!ta !== !!tb) return ta ? -1 : 1;          // yang punya mutasi lebih dulu
          if (ta !== tb) return ta < tb ? -1 : 1;          // mutasi pertama paling awal
          var ea = a.expired_date || "9999", eb = b.expired_date || "9999";
          if (ea !== eb) return ea < eb ? -1 : 1;          // lalu ED terdekat
          return (a.nomor_batch || "").localeCompare(b.nomor_batch || "");
        });
      })();

      var itemIndex = {};
      soItems.forEach(function (si) { itemIndex[kunciItemSO(si)] = si; });

      function fisikDari(b) {
        var si = itemIndex[b.id];
        if (si) return Number(si.stok_fisik);
        if (edLewat(b.expired_date)) return 0;
        return null;
      }

      // _stok_sistem: pakai stok_cutoff dari SO kalau sudah ada, fallback ke stok_sistem live
      batchObat.forEach(function (b) {
        var si = itemIndex[b.id];
        if (si && si.stok_cutoff !== null && si.stok_cutoff !== undefined && si.stok_cutoff !== "") {
          b._stok_sistem = Number(si.stok_cutoff);
        } else {
          b._stok_sistem = (b.stok_sistem !== null && b.stok_sistem !== undefined) ? b.stok_sistem : (b.stok_awal || 0);
        }
      });

      // Baris virtual "Tanpa batch": stok sistem = Σ mutasi tanpa batch s.d. cutoff (semuaTx sudah ter-cutoff).
      // Dibuat bila ada mutasi tanpa batch, sudah ada item SO tanpa batch, atau obat tidak dikelola per batch.
      // batchObat tetap hanya batch nyata (dipakai popup gabung/tambah mutasi); batchSO = batchObat + baris virtual.
      var batchSO = batchObat.slice();
      var adaTxTanpa = semuaTx.some(function (tx) { return !tx.batch; });
      if (adaTxTanpa || itemIndex[idBatchTanpa(obatId)] || obat.pakai_batch === false) {
        var saldoTanpa = 0;
        semuaTx.forEach(function (tx) {
          if (tx.batch) return;
          var j = Number(tx.jumlah) || 0;
          saldoTanpa += (tx.jenis === "masuk") ? j : -j;
        });
        batchSO.push({
          id: idBatchTanpa(obatId), _tanpa: true, obat: obatId,
          nomor_batch: "", expired_date: "", stok_awal: 0, _stok_sistem: saldoTanpa
        });
      }

      area.textContent = "";

      // Tombol kembali
      var tombolKembali = el("a", { href: "#/stockopname/sesuaikan", class: "btn btn-garis so-btn-kembali" }, "← Kembali");
      area.appendChild(tombolKembali);

      // Hitung selisih total (sistem vs fisik) untuk header
      var totalSistem = batchSO.reduce(function (acc, bt) {
        return fisikDari(bt) === null ? acc : acc + bt._stok_sistem;
      }, 0);
      var totalFisikHeader = batchSO.reduce(function (acc, bt) {
        var f = fisikDari(bt); return f !== null ? acc + f : acc;
      }, 0);
      var adaFisik = batchSO.some(function (bt) { return fisikDari(bt) !== null; });
      var diffTotal = totalFisikHeader - totalSistem;
      var diffTotalStr = (diffTotal > 0 ? "+" : "") + diffTotal;
      var satuan = obat.satuan || "";

      var semuaBatchSesuai = adaFisik && diffTotal === 0 && batchSO.every(function (bt) {
        var f = fisikDari(bt);
        return f === null || f === bt._stok_sistem;
      });
      var selisihTotalEl = adaFisik && semuaBatchSesuai
        ? el("span", { class: "lencana aman", style: "margin-left:8px" }, "✓ Sesuai")
        : adaFisik
        ? el("span", { class: "so-selisih-val " + (diffTotal > 0 ? "lebih" : diffTotal < 0 ? "kurang" : ""), style: "font-size:18px; margin-left:8px" },
            diffTotalStr + " " + satuan)
        : el("span", { class: "pudar", style: "font-size:13px; margin-left:8px" }, "belum dihitung");

      var headerItem = el("div", { class: "panel so-detail-header" }, [
        el("div", { style: "display:flex; align-items:baseline; flex-wrap:wrap; gap:4px; margin-bottom:4px" }, [
          el("h2", { style: "margin:0" }, obat.nama_utama || obatId),
          selisihTotalEl
        ]),
        el("div", { class: "pudar", style: "font-size:13px" }, [
          el("span", {}, obat.kode || ""),
          el("span", { style: "margin:0 8px" }, "·"),
          el("span", {}, "Sistem: " + formatAngka(totalSistem)),
          adaFisik ? el("span", {}, "  Fisik: " + formatAngka(totalFisikHeader)) : el("span", {}),
          el("span", { style: "margin:0 8px" }, "·"),
          el("span", {}, "Cutoff: " + formatTglPanjang(cutoff)),
          el("span", { style: "margin:0 8px" }, "·"),
          el("a", { href: "#/stok/obat/" + obatId }, "Kartu stok (live) →")
        ])
      ]);
      area.appendChild(headerItem);

      // --- Bagian 1: Ringkasan per batch ---
      var batchSelisih = batchSO.filter(function (b) {
        var fisik = fisikDari(b);
        return fisik !== null && fisik !== b._stok_sistem;
      });

      var seksiBatch = el("div", { class: "panel" });
      seksiBatch.appendChild(el("h3", { style: "margin:0 0 8px; font-size:15px" }, "Selisih per batch"));

      if (!batchSelisih.length) {
        seksiBatch.appendChild(el("p", { class: "pudar", style: "margin:0" }, "Tidak ada selisih per batch."));
      } else {
        var pesanBatch = el("p", { class: "pesan", hidden: true });
        seksiBatch.appendChild(pesanBatch);

        batchSelisih.forEach(function (b) {
          var fisik = fisikDari(b);
          var sistem = b._stok_sistem;
          var diff = fisik - sistem;
          var siItem = itemIndex[b.id];

          var indEdit = el("span", { class: "so-ind", "aria-hidden": "true" });
          var inpFisik = el("input", {
            type: "number", min: "0", step: "1",
            class: "inp-fisik so-inp-inline",
            value: fisik !== null ? String(fisik) : "",
            inputmode: "numeric",
            "aria-label": "Fisik " + (b.nomor_batch || "")
          });
          var diffSpan = el("span", { class: "so-selisih-val " + (diff > 0 ? "lebih" : "kurang") }, (diff > 0 ? "+" : "") + diff);
          var stateB = { itemId: siItem ? siItem.id : null };

          inpFisik.addEventListener("blur", function () {
            var v = inpFisik.value;
            if (v === "" || isNaN(Number(v))) return;
            indEdit.className = "so-ind so-ind-loading";
            simpanItemSO(soId, b.id, obatId, Number(v), stateB.itemId).then(function (rec) {
              stateB.itemId = rec.id;
              indEdit.className = "so-ind so-ind-ok";
              var nd = Number(v) - sistem;
              diffSpan.textContent = (nd > 0 ? "+" : "") + nd;
              diffSpan.className = "so-selisih-val " + (nd > 0 ? "lebih" : (nd < 0 ? "kurang" : ""));
            }, function () { indEdit.className = "so-ind so-ind-err"; });
          });
          inpFisik.addEventListener("keydown", function (e) { if (e.key === "Enter") inpFisik.blur(); });

          seksiBatch.appendChild(el("div", { class: "so-batch-baris-detail" }, [
            el("div", { class: "so-batch-info" }, [
              el("span", { class: "so-batch-no" }, b._tanpa ? "Tanpa batch" : (b.nomor_batch || "(tanpa nomor)")),
              el("span", { class: "pudar" }, b.expired_date ? " · ED " + formatED(b.expired_date) : "")
            ]),
            el("div", { class: "so-batch-stok" }, [
              el("span", { class: "pudar" }, "Sistem: "),
              el("strong", {}, formatAngka(sistem)),
              el("span", { class: "pudar" }, "  Fisik: "),
              inpFisik, indEdit
            ]),
            el("div", { class: "so-batch-diff" }, [diffSpan, el("span", { class: "pudar" }, " " + (obat.satuan || ""))])
          ]));
        });
      }
      area.appendChild(seksiBatch);

      // Merge batch dan tambah mutasi kini ada di popup (tombol di headerTx)

      // --- Bagian 3: Kartu stok editable ---
      var seksiTx = el("div", { class: "panel" });
      var headerTx = el("div", { class: "so-tx-header" }, [
        el("h3", { style: "margin:0; font-size:15px" }, "Riwayat transaksi")
      ]);
      seksiTx.appendChild(headerTx);

      var totalStokAwal = batchObat.reduce(function (acc, bt) { return acc + (Number(bt.stok_awal) || 0); }, 0);

      // Tombol recalc stok_sistem semua batch obat ini
      var indRecalc = el("span", { class: "so-ind", "aria-hidden": "true" });
      var tombolRecalc = el("button", { type: "button", class: "btn btn-hijau", style: "font-size:13px" }, "⟳ Sinkronkan stok cutoff");
      tombolRecalc.addEventListener("click", function () {
        tombolRecalc.disabled = true;
        indRecalc.className = "so-ind so-ind-loading";

        // Hitung stok_cutoff dari semuaTx (sudah difilter s.d. cutoff)
        var sisaBatch = {};
        batchObat.forEach(function (bt) { sisaBatch[bt.id] = Number(bt.stok_awal) || 0; });
        semuaTx.forEach(function (tx) {
          if (!tx.batch) return;
          var j = Number(tx.jumlah) || 0;
          if (!(tx.batch in sisaBatch)) sisaBatch[tx.batch] = 0;
          if (tx.jenis === "masuk") sisaBatch[tx.batch] += j;
          else sisaBatch[tx.batch] -= j;
        });

        // Simpan ke stockopname_item.stok_cutoff — tidak sentuh batch.stok_sistem.
        // Hanya untuk item SO yang sudah ada (tidak membuat item baru: angka kosong di PocketBase
        // v0.22 tersimpan sebagai 0 dan akan terbaca sebagai fisik = 0).
        var patches = [];
        batchObat.forEach(function (bt) {
          var cutoff = sisaBatch[bt.id] || 0;
          var si = itemIndex[bt.id];
          if (!si) return;
          patches.push(LPLPO.ubah("stockopname_item", si.id, { stok_cutoff: cutoff }).then(function () {
            bt._stok_sistem = cutoff;
            si.stok_cutoff = cutoff;
          }));
        });
        Promise.all(patches).then(function () {
          indRecalc.className = "so-ind so-ind-ok";
          tombolRecalc.disabled = false;
          renderDetailItem(area, soId, obatId, soTanggal);
        }, function () {
          indRecalc.className = "so-ind so-ind-err";
          tombolRecalc.disabled = false;
        });
      });

      // Tombol Gabung batch (popup)
      var tombolGabung = el("button", { type: "button", class: "btn btn-sekunder", style: "font-size:13px" }, "⇄ Gabung batch");
      tombolGabung.addEventListener("click", function () {
        bukaPopupGabungBatch(batchObat, obatId, function () { renderDetailItem(area, soId, obatId); });
      });

      // Tombol Tambah mutasi (popup)
      var tombolTambahMutasi = el("button", { type: "button", class: "btn btn-hijau-garis", style: "font-size:13px" }, "+ Tambah mutasi");
      tombolTambahMutasi.addEventListener("click", function () {
        bukaPopupTambahMutasi(batchObat, obat, function (pesan) {
          soPesanTerakhir = pesan;
          renderDetailItem(area, soId, obatId);
        });
      });

      // Kiri: Recalc | Kanan: Gabung batch + Tambah mutasi
      var grupKiri = el("div", { style: "display:flex;gap:8px;align-items:center" }, [tombolRecalc, indRecalc]);
      var grupKanan = el("div", { style: "display:flex;gap:8px;align-items:center" }, [tombolGabung, tombolTambahMutasi]);
      headerTx.appendChild(el("div", { class: "so-header-aksi" }, [grupKiri, grupKanan]));

      var pesanTxGlobal = el("p", { class: "pesan", hidden: true });
      seksiTx.appendChild(pesanTxGlobal);

      var wadahTabel = el("div", {});
      seksiTx.appendChild(wadahTabel);

      function labelBatchTx(tx) {
        if (!tx.batch) return "tanpa batch";
        var bt = (tx.expand && tx.expand.batch) || batchObat.filter(function (x) { return x.id === tx.batch; })[0];
        if (!bt) return "?";
        return (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : "");
      }
      function opsiBatch() {
        return [el("option", { value: "" }, "Tanpa batch")].concat(
          batchObat.map(function (bt) {
            return el("option", { value: bt.id }, (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : "") + " · stok " + bt._stok_sistem);
          })
        );
      }

      // Hitung sisa total + sisa per-batch berjalan
      function hitungSisa(daftar) {
        var sisaTotal = totalStokAwal;
        var runBatch = {};
        batchObat.forEach(function (bt) { runBatch[bt.id] = Number(bt.stok_awal) || 0; });
        return daftar.map(function (tx) {
          var j = Number(tx.jumlah) || 0;
          // Mutasi tanpa batch dihitung sebagai baris virtual "Tanpa batch" (saldo mulai 0)
          var bid = tx.batch || OPSI_TANPA_BATCH;
          if (tx.jenis === "masuk") {
            sisaTotal += j;
            runBatch[bid] = (runBatch[bid] || 0) + j;
          } else {
            sisaTotal -= j;
            runBatch[bid] = (runBatch[bid] || 0) - j;
          }
          return { total: sisaTotal, batch: runBatch[bid] };
        });
      }

      function gambarTabel() {
        var terurut = semuaTx.slice().sort(function (a, c) {
          var tglCmp = (a.tanggal || "").localeCompare(c.tanggal || "");
          if (tglCmp !== 0) return tglCmp;
          // Hari sama: masuk dulu (urutan saldo tidak minus sementara)
          var jA = a.jenis === "masuk" ? 0 : 1;
          var jC = c.jenis === "masuk" ? 0 : 1;
          if (jA !== jC) return jA - jC;
          return (a.id || "").localeCompare(c.id || "");
        });
        var sisaArr = hitungSisa(terurut);
        wadahTabel.textContent = "";

        var thead = el("thead", {}, [el("tr", {}, [
          el("th", {}, "Tanggal"),
          el("th", {}, "Dari / Ke"),
          el("th", {}, "Batch"),
          el("th", { class: "n" }, "Masuk"),
          el("th", { class: "n" }, "Keluar"),
          el("th", { class: "n so-th-sisa" }, "Sisa\nbatch"),
          el("th", { class: "n so-th-sisa" }, "Sisa\ntotal"),
          el("th", {}, "")
        ])]);
        var tbody = el("tbody", {});

        // Baris saldo awal per batch
        // Hanya tampilkan baris saldo awal yang ada jumlahnya (stok_awal > 0)
        var batchAwalAda = batchObat.filter(function (bt) { return (Number(bt.stok_awal) || 0) > 0; });
        var sisaTotalAwalKumulatif = 0;
        batchAwalAda.forEach(function (bt, bi) {
          var stokAwalBt = Number(bt.stok_awal) || 0;
          sisaTotalAwalKumulatif += stokAwalBt;
          tbody.appendChild(el("tr", { class: "so-tx-tr-awal" }, [
            el("td", { "data-label": "Tanggal", class: "pudar" }, bi === 0 ? "Saldo awal" : ""),
            el("td", { "data-label": "Dari / Ke" }, ""),
            el("td", { "data-label": "Batch", class: "pudar" }, labelBatch(bt)),
            el("td", { "data-label": "Masuk", class: "n" }, formatAngka(stokAwalBt)),
            el("td", { "data-label": "Keluar", class: "n" }, ""),
            el("td", { "data-label": "Sisa batch", class: "n" }, formatAngka(stokAwalBt)),
            el("td", { "data-label": "Sisa total", class: "n" }, formatAngka(sisaTotalAwalKumulatif)),
            el("td", {}, "")
          ]));
        });
        // Jika tidak ada batch sama sekali, tampilkan satu baris ringkasan
        if (!batchObat.length) {
          tbody.appendChild(el("tr", { class: "so-tx-tr-awal" }, [
            el("td", { class: "pudar" }, "Saldo awal"),
            el("td", {}), el("td", {}),
            el("td", { class: "n" }, formatAngka(totalStokAwal)),
            el("td", { class: "n" }, ""),
            el("td", { class: "n" }, ""),
            el("td", { class: "n" }, formatAngka(totalStokAwal)),
            el("td", {})
          ]));
        }

        terurut.forEach(function (tx, idx) {
          var unitNama = (tx.expand && tx.expand.unit && tx.expand.unit.nama) || "-";
          var sisaObj = sisaArr[idx];
          var sisaTotal = sisaObj.total;
          var sisaBatch = sisaObj.batch;
          var jumlah = Number(tx.jumlah) || 0;

          // Tanggal editable
          var tdTgl = el("td", { "data-label": "Tanggal", class: "so-td-edit" });
          var spanTgl = el("span", {}, formatTglPendek(tx.tanggal));
          var inpTgl = el("input", { type: "date", class: "so-inp-tabel", value: tx.tanggal ? tx.tanggal.slice(0, 10) : "", hidden: true });
          var indTgl = el("span", { class: "so-ind", "aria-hidden": "true" });
          tdTgl.appendChild(spanTgl); tdTgl.appendChild(inpTgl); tdTgl.appendChild(indTgl);
          spanTgl.addEventListener("click", function () { spanTgl.hidden = true; inpTgl.hidden = false; inpTgl.focus(); });
          inpTgl.addEventListener("blur", function () {
            if (!inpTgl.value || inpTgl.value === (tx.tanggal ? tx.tanggal.slice(0, 10) : "")) { spanTgl.hidden = false; inpTgl.hidden = true; return; }
            indTgl.className = "so-ind so-ind-loading";
            LPLPO.ubah("mutasi", tx.id, { tanggal: inpTgl.value }).then(function () {
              tx.tanggal = inpTgl.value; spanTgl.textContent = formatTglPendek(inpTgl.value);
              spanTgl.hidden = false; inpTgl.hidden = true; indTgl.className = "so-ind so-ind-ok";
              gambarTabel();
            }, function () { indTgl.className = "so-ind so-ind-err"; spanTgl.hidden = false; inpTgl.hidden = true; });
          });

          // Batch editable (dropdown)
          var tdBatch = el("td", { "data-label": "Batch", class: "so-td-edit" });
          var spanBatch = el("span", {}, labelBatchTx(tx));
          var selBatch = el("select", { class: "so-pilih-mutasi", hidden: true });
          var indBatch = el("span", { class: "so-ind", "aria-hidden": "true" });
          var batchOpsLoaded = false;
          tdBatch.appendChild(spanBatch); tdBatch.appendChild(selBatch); tdBatch.appendChild(indBatch);
          spanBatch.addEventListener("click", function () {
            if (!batchOpsLoaded) { batchOpsLoaded = true; opsiBatch().forEach(function (opt) { selBatch.appendChild(opt); }); selBatch.value = tx.batch || ""; }
            spanBatch.hidden = true; selBatch.hidden = false; selBatch.focus();
          });
          selBatch.addEventListener("change", function () {
            indBatch.className = "so-ind so-ind-loading";
            LPLPO.ubah("mutasi", tx.id, { batch: selBatch.value || null }).then(function () {
              tx.batch = selBatch.value;
              var bt = batchObat.filter(function (x) { return x.id === selBatch.value; })[0];
              spanBatch.textContent = bt ? (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : "") : "Tanpa batch";
              spanBatch.hidden = false; selBatch.hidden = true; indBatch.className = "so-ind so-ind-ok";
            }, function () { indBatch.className = "so-ind so-ind-err"; spanBatch.hidden = false; selBatch.hidden = true; });
          });
          selBatch.addEventListener("blur", function () { setTimeout(function () { spanBatch.hidden = false; selBatch.hidden = true; }, 200); });

          // Jumlah editable
          var tdMasuk = el("td", { "data-label": "Masuk", class: "n so-td-edit" });
          var tdKeluar = el("td", { "data-label": "Keluar", class: "n so-td-edit" });
          var tdSisaBatch = el("td", { "data-label": "Sisa batch", class: "n" + (sisaBatch !== null && sisaBatch < 0 ? " ks-negatif" : "") },
            sisaBatch !== null ? formatAngka(sisaBatch) : "—");
          var tdSisa = el("td", { "data-label": "Sisa total", class: "n" + (sisaTotal < 0 ? " ks-negatif" : "") }, formatAngka(sisaTotal));

          function buatSelJ(td) {
            var spanJ = el("span", {}, formatAngka(jumlah));
            var inpJ = el("input", { type: "number", min: "1", step: "1", class: "so-inp-tabel so-inp-jumlah-tabel", value: String(jumlah), hidden: true, inputmode: "numeric" });
            var indJ = el("span", { class: "so-ind", "aria-hidden": "true" });
            td.appendChild(spanJ); td.appendChild(inpJ); td.appendChild(indJ);
            spanJ.addEventListener("click", function () { spanJ.hidden = true; inpJ.hidden = false; inpJ.focus(); inpJ.select(); });
            inpJ.addEventListener("blur", function () {
              var v = Number(inpJ.value);
              if (!v || v < 1) { spanJ.hidden = false; inpJ.hidden = true; return; }
              if (v === jumlah) { spanJ.hidden = false; inpJ.hidden = true; return; }
              indJ.className = "so-ind so-ind-loading";
              LPLPO.ubah("mutasi", tx.id, { jumlah: v }).then(function () {
                tx.jumlah = v; jumlah = v; spanJ.textContent = formatAngka(v);
                spanJ.hidden = false; inpJ.hidden = true; indJ.className = "so-ind so-ind-ok";
                gambarTabel();
              }, function () { indJ.className = "so-ind so-ind-err"; spanJ.hidden = false; inpJ.hidden = true; });
            });
            inpJ.addEventListener("keydown", function (e) {
              if (e.key === "Enter") inpJ.blur();
              if (e.key === "Escape") { inpJ.value = String(jumlah); inpJ.blur(); }
            });
          }

          if (tx.jenis === "masuk") { buatSelJ(tdMasuk); tdKeluar.textContent = ""; }
          else { tdMasuk.textContent = ""; buatSelJ(tdKeluar); }

          // Aksi: Pisah + Hapus
          var tdHapus = el("td", { class: "so-td-aksi" });

          // Tombol Pisah (semua baris, termasuk yang tanpa batch)
          var tombolPisah = el("button", { type: "button", class: "btn btn-garis so-btn-pisah-tx", title: "Pisahkan ke dua batch", "aria-label": "Pisah" }, "⇥");
          tombolPisah.addEventListener("click", function () {
            bukaPopupPisahBatch(tx, jumlah, batchObat, function () {
              // reload
              renderDetailItem(area, soId, obatId);
            });
          });
          tdHapus.appendChild(tombolPisah);

          var tombolH = el("button", { type: "button", class: "btn btn-bahaya so-btn-hapus-tx", title: "Hapus", "aria-label": "Hapus" }, "✕");
          tombolH.addEventListener("click", function () {
            var label = formatTglPendek(tx.tanggal) + " · " + (tx.jenis === "masuk" ? "Masuk" : "Keluar") + " " + jumlah + " · " + unitNama;
            if (!window.confirm("Hapus mutasi ini?\n" + label + "\n\nTidak bisa dibatalkan.")) return;
            tombolH.disabled = true;
            hapusRecord("mutasi", tx.id).then(function () {
              semuaTx.splice(semuaTx.indexOf(tx), 1);
              gambarTabel();
              pesanTxGlobal.textContent = "Mutasi dihapus. Klik \"Sinkronkan stok cutoff\" supaya stok cutoff obat ini terbarui.";
              pesanTxGlobal.className = "pesan info"; pesanTxGlobal.hidden = false;
            }, function (err) {
              pesanTxGlobal.textContent = (err && (err.pesan || err.message)) || "Gagal menghapus.";
              pesanTxGlobal.className = "pesan galat"; pesanTxGlobal.hidden = false;
              tombolH.disabled = false;
            });
          });
          tdHapus.appendChild(tombolH);

          tbody.appendChild(el("tr", {}, [tdTgl, el("td", { "data-label": "Dari / Ke" }, unitNama), tdBatch, tdMasuk, tdKeluar, tdSisaBatch, tdSisa, tdHapus]));
        });

        var tabel = el("table", { class: "kartu so-tx-tabel" }, [thead, tbody]);
        wadahTabel.appendChild(el("div", { class: "tabel-gulir" }, [tabel]));
        wadahTabel.appendChild(el("p", { class: "pudar", style: "margin:4px 0 8px; font-size:13px" }, "Klik tanggal, batch, atau jumlah untuk mengedit langsung."));
      }

      gambarTabel();
      area.appendChild(seksiTx);

    }, function (err) {
      tanganiGalat(err, function () { renderDetailItem(area, soId, obatId); }, area);
    });
  }

  // --- Popup helper: buat dan tampilkan modal ---
  function buatModal(judul, onTutup) {
    var overlay = el("div", { class: "modal-overlay aktif", role: "dialog", "aria-modal": "true", "aria-label": judul });
    var kotak = el("div", { class: "modal-kotak" });
    var kepalaModal = el("div", { class: "modal-kepala" });
    kepalaModal.appendChild(el("h2", { class: "modal-judul" }, judul));
    var tombolX = el("button", { type: "button", class: "modal-tutup", "aria-label": "Tutup" }, "✕");
    tombolX.addEventListener("click", function () {
      overlay.remove();
      if (onTutup) onTutup();
    });
    kepalaModal.appendChild(tombolX);
    kotak.appendChild(kepalaModal);
    overlay.appendChild(kotak);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) { overlay.remove(); if (onTutup) onTutup(); }
    });
    return { overlay: overlay, kotak: kotak, tutup: function () { overlay.remove(); } };
  }

  // --- Popup: Gabungkan batch ---
  function bukaPopupGabungBatch(batchObat, obatId, onSelesai) {
    var modal = buatModal("Gabungkan batch");
    var kotak = modal.kotak;

    kotak.appendChild(el("p", { class: "pudar", style: "margin:0 0 12px; font-size:13px" },
      "Pilih dua batch yang sebenarnya sama. Semua transaksi akan dipindah ke batch tujuan, lalu batch asal dihapus."));

    function labelBatch(bt) {
      return (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : "") + " · stok " + bt._stok_sistem;
    }

    var pilAsal = el("select", { class: "so-pilih-mutasi" },
      [el("option", { value: "" }, "— Batch asal (akan dihapus) —")].concat(
        batchObat.map(function (bt) { return el("option", { value: bt.id }, labelBatch(bt)); })
      ));
    var pilTujuan = el("select", { class: "so-pilih-mutasi" },
      [el("option", { value: "" }, "— Batch tujuan (dipertahankan) —")].concat(
        batchObat.map(function (bt) { return el("option", { value: bt.id }, labelBatch(bt)); })
      ));
    var tombolMerge = el("button", { type: "button", class: "btn btn-bahaya", disabled: true }, "Gabungkan");
    var pesanMerge = el("p", { class: "pesan", hidden: true });

    function cekMerge() {
      tombolMerge.disabled = !pilAsal.value || !pilTujuan.value || pilAsal.value === pilTujuan.value;
    }
    pilAsal.addEventListener("change", cekMerge);
    pilTujuan.addEventListener("change", cekMerge);

    tombolMerge.addEventListener("click", function () {
      var asalId = pilAsal.value;
      var tujuanId = pilTujuan.value;
      var asalLabel = pilAsal.options[pilAsal.selectedIndex].textContent;
      var tujuanLabel = pilTujuan.options[pilTujuan.selectedIndex].textContent;
      if (!window.confirm("Gabungkan batch?\n\nAsal: " + asalLabel + "\nTujuan: " + tujuanLabel + "\n\nTidak bisa dibatalkan.")) return;

      tombolMerge.disabled = true;
      tombolMerge.textContent = "Menggabungkan...";
      pesanMerge.hidden = true;

      daftarSemua("mutasi", { filter: 'batch = "' + asalId + '"', perPage: 500 }).then(function (txAsal) {
        var patchAll = txAsal.items.map(function (tx) {
          return LPLPO.ubah("mutasi", tx.id, { batch: tujuanId });
        });
        return Promise.all(patchAll);
      }).then(function () {
        return hapusRecord("batch", asalId);
      }).then(function () {
        modal.tutup();
        onSelesai();
      }, function (err) {
        pesanMerge.textContent = (err && (err.pesan || err.message)) || "Gagal menggabungkan.";
        pesanMerge.className = "pesan galat"; pesanMerge.hidden = false;
        tombolMerge.disabled = false; tombolMerge.textContent = "Gabungkan";
      });
    });

    var tombolBatal = el("button", { type: "button", class: "btn btn-garis" }, "Batal");
    tombolBatal.addEventListener("click", function () { modal.tutup(); });

    var isiModal = el("div", { class: "modal-isi" }, [
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Batch asal (akan dihapus)"), pilAsal]),
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Batch tujuan (dipertahankan)"), pilTujuan]),
      pesanMerge
    ]);
    var tombolModal = el("div", { class: "modal-tombol" }, [tombolBatal, tombolMerge]);
    kotak.appendChild(isiModal);
    kotak.appendChild(tombolModal);
  }

  // --- Popup: Tambah mutasi baru ---
  function bukaPopupTambahMutasi(batchObat, obat, onSelesai) {
    var modal = buatModal("Tambah mutasi baru");
    var kotak = modal.kotak;

    var pilUnit = el("select", { class: "so-pilih-mutasi" }, [el("option", { value: "" }, "Memuat unit...")]);
    var petunjuk = el("p", { class: "pudar", style: "margin:0 0 8px; font-size:13px" }, "");
    var inpTambahJumlah = el("input", { type: "number", min: "1", step: "1", class: "so-inp-edit", placeholder: "Jumlah", inputmode: "numeric", "aria-label": "Jumlah" });
    var skrg = new Date();
    var tglHari = skrg.getFullYear() + "-" + String(skrg.getMonth() + 1).padStart(2, "0") + "-" + String(skrg.getDate()).padStart(2, "0");
    var tglTambahObj = buatInputTanggal(tglHari, function(){}, { kelas: "so-inp-edit", label: "Tanggal mutasi" });
    var inpTambahTanggal = tglTambahObj.el;
    var pilBatchTambah = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch" },
      [el("option", { value: "" }, "Tanpa batch")].concat(batchObat.map(function (bt) {
        return el("option", { value: bt.id }, (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : ""));
      })));
    if (batchObat.length) pilBatchTambah.value = batchObat[0].id;
    var tombolTambah = el("button", { type: "button", class: "btn btn-utama", disabled: true }, "Tambah mutasi");
    var pesanTambah = el("p", { class: "pesan", hidden: true });
    var tombolBatal = el("button", { type: "button", class: "btn btn-garis" }, "Batal");
    tombolBatal.addEventListener("click", function () { modal.tutup(); });

    function jenisDipilih() {
      var opt = pilUnit.options[pilUnit.selectedIndex];
      if (!opt || !opt.value) return "";
      return opt.getAttribute("data-tipe") === "sumber" ? "masuk" : "keluar";
    }

    LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: "aktif=true" }).then(function (du) {
      pilUnit.textContent = "";
      pilUnit.appendChild(el("option", { value: "" }, "— Pilih unit asal/tujuan —"));
      du.items.forEach(function (u) {
        pilUnit.appendChild(el("option", { value: u.id, "data-tipe": u.tipe || "" }, u.nama));
      });
      pilUnit.addEventListener("change", function () {
        tombolTambah.disabled = !pilUnit.value;
        var j = jenisDipilih();
        var nama = pilUnit.options[pilUnit.selectedIndex].textContent;
        petunjuk.textContent = j === "masuk" ? "Dicatat sebagai: masuk dari " + nama
          : (j === "keluar" ? "Dicatat sebagai: keluar ke " + nama : "");
      });
    }, function () {
      pilUnit.textContent = "";
      pilUnit.appendChild(el("option", { value: "" }, "Gagal memuat unit"));
    });

    tombolTambah.addEventListener("click", function () {
      var unitId = pilUnit.value;
      var jumlah = Number(inpTambahJumlah.value);
      var tanggal = tglTambahObj.getValue() || tglHari;
      var jenis = jenisDipilih();
      if (!unitId || !jenis || !jumlah || jumlah < 1) {
        pesanTambah.textContent = "Pilih unit dan isi jumlah.";
        pesanTambah.className = "pesan galat"; pesanTambah.hidden = false; return;
      }
      tombolTambah.disabled = true; tombolTambah.textContent = "Menyimpan...";
      LPLPO.buat("mutasi", {
        obat: obat.id,
        batch: pilBatchTambah.value || undefined,
        unit: unitId,
        jenis: jenis,
        jumlah: jumlah,
        tanggal: tanggal,
        status: "confirmed",
        catatan: "Koreksi stockopname"
      }).then(function () {
        modal.tutup();
        onSelesai("Mutasi baru ditambahkan (" + (jenis === "masuk" ? "masuk" : "keluar") + " " + jumlah + ").");
      }, function (err) {
        pesanTambah.textContent = (err && (err.pesan || err.message)) || "Gagal menyimpan.";
        pesanTambah.className = "pesan galat"; pesanTambah.hidden = false;
        tombolTambah.disabled = false; tombolTambah.textContent = "Tambah mutasi";
      });
    });

    var isiModal = el("div", { class: "modal-isi" }, [
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Unit asal/tujuan"), pilUnit]),
      petunjuk,
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Jumlah"), inpTambahJumlah]),
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Tanggal"), inpTambahTanggal]),
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Batch"), pilBatchTambah]),
      pesanTambah
    ]);
    var tombolModal = el("div", { class: "modal-tombol" }, [tombolBatal, tombolTambah]);
    kotak.appendChild(isiModal);
    kotak.appendChild(tombolModal);
  }

  // --- Popup: Pisahkan batch satu mutasi jadi dua ---
  function bukaPopupPisahBatch(tx, jumlahAsal, batchObat, onSelesai) {
    var modal = buatModal("Pisahkan batch");
    var kotak = modal.kotak;

    var labelBatchAsal = tx.batch
      ? batchObat.reduce(function (acc, bt) { return bt.id === tx.batch ? labelBatch(bt) : acc; }, "?")
      : "Tanpa batch";
    var kunciAsal = tx.batch || OPSI_TANPA_BATCH;

    kotak.appendChild(el("p", { style: "margin:0 0 12px; font-size:13px" },
      "Mutasi " + (tx.jenis === "masuk" ? "masuk" : "keluar") + " " + jumlahAsal + " dari batch " + labelBatchAsal + " akan dipecah menjadi dua baris dengan batch berbeda (boleh \"Tanpa batch\")."));
    kotak.appendChild(el("p", { class: "pudar", style: "margin:0 0 12px; font-size:12px" },
      "Setelah memisahkan, jalankan \"Sinkronkan stok obat ini\" di menu Stok supaya stok live ikut diperbarui."));

    var inpJumlah1 = el("input", { type: "number", min: "1", step: "1", max: String(jumlahAsal - 1), class: "so-inp-edit", placeholder: "Jumlah batch 1", inputmode: "numeric", "aria-label": "Jumlah batch 1" });
    var lblJumlah2 = el("span", { class: "pudar", style: "font-size:13px" }, "Batch 2: —");

    inpJumlah1.addEventListener("input", function () {
      var v = Number(inpJumlah1.value);
      if (v > 0 && v < jumlahAsal) {
        lblJumlah2.textContent = "Batch 2: " + (jumlahAsal - v);
      } else {
        lblJumlah2.textContent = "Batch 2: —";
      }
    });

    // Opsi batch: semua batch nyata + "Tanpa batch" (nilai OPSI_TANPA_BATCH → relasi batch dikosongkan)
    function opsiBatchPisah() {
      return batchObat.map(function (bt) {
        return el("option", { value: bt.id }, labelBatch(bt));
      }).concat([el("option", { value: OPSI_TANPA_BATCH }, "Tanpa batch")]);
    }
    var pilBatch1 = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch untuk bagian 1" }, opsiBatchPisah());
    pilBatch1.value = kunciAsal;
    var pilBatch2 = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch untuk bagian 2" },
      [el("option", { value: "" }, "— Pilih batch —")].concat(opsiBatchPisah().filter(function (o) { return o.value !== kunciAsal; })));

    var tombolPisah = el("button", { type: "button", class: "btn btn-utama" }, "Pisahkan");
    var pesanPisah = el("p", { class: "pesan", hidden: true });
    var tombolBatal = el("button", { type: "button", class: "btn btn-garis" }, "Batal");
    tombolBatal.addEventListener("click", function () { modal.tutup(); });

    tombolPisah.addEventListener("click", function () {
      var j1 = Number(inpJumlah1.value);
      var j2 = jumlahAsal - j1;
      var b1 = pilBatch1.value;
      var b2 = pilBatch2.value;
      if (!j1 || j1 < 1 || j1 >= jumlahAsal) {
        pesanPisah.textContent = "Jumlah batch 1 harus antara 1 dan " + (jumlahAsal - 1) + ".";
        pesanPisah.className = "pesan galat"; pesanPisah.hidden = false; return;
      }
      if (!b2) {
        pesanPisah.textContent = "Pilih batch untuk bagian 2.";
        pesanPisah.className = "pesan galat"; pesanPisah.hidden = false; return;
      }
      if (b1 === b2) {
        pesanPisah.textContent = "Batch 1 dan batch 2 harus berbeda.";
        pesanPisah.className = "pesan galat"; pesanPisah.hidden = false; return;
      }
      tombolPisah.disabled = true; tombolPisah.textContent = "Memproses...";
      pesanPisah.hidden = true;

      // "Tanpa batch" → relasi batch kosong (null saat mengubah, dihilangkan saat membuat baru)
      var b1Nilai = (b1 === OPSI_TANPA_BATCH) ? null : b1;
      var b2Nilai = (b2 === OPSI_TANPA_BATCH) ? undefined : b2;

      // Patch mutasi asli: ganti jumlah ke j1 dan batch ke b1
      LPLPO.ubah("mutasi", tx.id, { jumlah: j1, batch: b1Nilai }).then(function () {
        // Buat mutasi baru untuk j2 dengan batch b2
        return LPLPO.buat("mutasi", {
          obat: tx.obat,
          batch: b2Nilai,
          unit: tx.unit,
          jenis: tx.jenis,
          jumlah: j2,
          tanggal: tx.tanggal,
          status: "confirmed",
          catatan: (tx.catatan ? tx.catatan + " " : "") + "[pisah batch]"
        });
      }).then(function () {
        modal.tutup();
        onSelesai();
      }, function (err) {
        pesanPisah.textContent = (err && (err.pesan || err.message)) || "Gagal memisahkan.";
        pesanPisah.className = "pesan galat"; pesanPisah.hidden = false;
        tombolPisah.disabled = false; tombolPisah.textContent = "Pisahkan";
      });
    });

    var isiModal = el("div", { class: "modal-isi" }, [
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Batch bagian 1"), pilBatch1]),
      el("div", { class: "field" }, [
        el("label", { class: "field-label" }, "Jumlah bagian 1"),
        el("div", { style: "display:flex; gap:8px; align-items:center" }, [inpJumlah1, lblJumlah2])
      ]),
      el("div", { class: "field" }, [el("label", { class: "field-label" }, "Batch bagian 2"), pilBatch2]),
      pesanPisah
    ]);
    var tombolModal = el("div", { class: "modal-tombol" }, [tombolBatal, tombolPisah]);
    kotak.appendChild(isiModal);
    kotak.appendChild(tombolModal);
  }

  // Tambah mutasi baru: jenis ditentukan dari tipe unit
  function muatUnitUntukSO(areaTransaksi, batch, obat, batchObat, onSelesai) {
    var bagianTambah = el("div", { class: "so-form-tambah" });
    bagianTambah.appendChild(el("p", { class: "pudar", style: "margin:0 0 8px" }, "Atau tambah mutasi baru:"));

    var pilUnit = el("select", { class: "so-pilih-mutasi" }, [el("option", { value: "" }, "Memuat unit...")]);
    var petunjuk = el("p", { class: "pudar", style: "margin:0 0 8px" }, "");
    var inpTambahJumlah = el("input", { type: "number", min: "1", step: "1", class: "so-inp-edit", placeholder: "Jumlah", inputmode: "numeric", "aria-label": "Jumlah" });
    var skrg = new Date();
    var tglHari = skrg.getFullYear() + "-" + String(skrg.getMonth() + 1).padStart(2, "0") + "-" + String(skrg.getDate()).padStart(2, "0");
    var inpTambahTanggal = el("input", { type: "date", class: "so-inp-edit", value: tglHari, "aria-label": "Tanggal mutasi" });
    var pilBatchTambah = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch mutasi baru" },
      [el("option", { value: "" }, "Tanpa batch")].concat(batchObat.map(function (bt) {
        return el("option", { value: bt.id }, (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : ""));
      })));
    pilBatchTambah.value = batch.id;
    var tombolTambah = el("button", { type: "button", class: "btn btn-utama", disabled: true }, "Tambah mutasi");
    var pesanTambah = el("p", { class: "pesan", hidden: true });

    bagianTambah.appendChild(pilUnit);
    bagianTambah.appendChild(petunjuk);
    bagianTambah.appendChild(inpTambahJumlah);
    bagianTambah.appendChild(inpTambahTanggal);
    bagianTambah.appendChild(pilBatchTambah);
    bagianTambah.appendChild(tombolTambah);
    bagianTambah.appendChild(pesanTambah);
    areaTransaksi.appendChild(bagianTambah);

    function jenisDipilih() {
      var opt = pilUnit.options[pilUnit.selectedIndex];
      if (!opt || !opt.value) return "";
      return opt.getAttribute("data-tipe") === "sumber" ? "masuk" : "keluar";
    }

    LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: "aktif=true" }).then(function (du) {
      pilUnit.textContent = "";
      pilUnit.appendChild(el("option", { value: "" }, "— Pilih unit asal/tujuan —"));
      du.items.forEach(function (u) {
        pilUnit.appendChild(el("option", { value: u.id, "data-tipe": u.tipe || "" }, u.nama));
      });
      pilUnit.addEventListener("change", function () {
        tombolTambah.disabled = !pilUnit.value;
        var j = jenisDipilih();
        var nama = pilUnit.options[pilUnit.selectedIndex].textContent;
        petunjuk.textContent = j === "masuk" ? "Dicatat sebagai: masuk dari " + nama
          : (j === "keluar" ? "Dicatat sebagai: keluar ke " + nama : "");
      });
    }, function () {
      pilUnit.textContent = "";
      pilUnit.appendChild(el("option", { value: "" }, "Gagal memuat unit"));
    });

    tombolTambah.addEventListener("click", function () {
      var unitId = pilUnit.value;
      var jumlah = Number(inpTambahJumlah.value);
      var tanggal = tglTambahObj.getValue() || tglHari;
      var jenis = jenisDipilih();
      if (!unitId || !jenis || !jumlah || jumlah < 1) {
        pesanTambah.textContent = "Pilih unit dan isi jumlah.";
        pesanTambah.className = "pesan galat"; pesanTambah.hidden = false; return;
      }
      tombolTambah.disabled = true; tombolTambah.textContent = "Menyimpan...";
      LPLPO.buat("mutasi", {
        obat: obat.id,
        batch: pilBatchTambah.value || undefined,
        unit: unitId,
        jenis: jenis,
        jumlah: jumlah,
        tanggal: tanggal,
        status: "confirmed",
        catatan: "Koreksi stockopname"
      }).then(function () {
        onSelesai("Mutasi baru ditambahkan (" + (jenis === "masuk" ? "masuk" : "keluar") + " " + jumlah + ").");
      }, function (err) {
        pesanTambah.textContent = (err && (err.pesan || err.message)) || "Gagal menyimpan.";
        pesanTambah.className = "pesan galat"; pesanTambah.hidden = false;
        tombolTambah.disabled = false; tombolTambah.textContent = "Tambah mutasi";
      });
    });
  }



  // ---------- Halaman: Stok (gabungan Kartu stok + Stok & batch) ----------
  // #/stok            → tab "Per obat": daftar stok semua obat + tombol Sinkronkan semua stok
  // #/stok/batch      → tab "Batch": semua batch urut ED
  // #/stok/obat/<id>  → kartu stok satu obat (rincian batch + riwayat mutasi)
  // Alamat lama #/kartu-stok dialihkan ke sini oleh halamanAktif().
  function tabStok(aktif) {
    var nav = el("nav", { class: "tab", "aria-label": "Stok" });
    [["obat", "Per obat"], ["batch", "Batch"]].forEach(function (t) {
      var a = el("a", { href: "#/stok/" + t[0] }, t[1]);
      if (t[0] === aktif) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    return nav;
  }

  function renderStok(sub) {
    var bagian = (sub || "").split("/");
    var tab = bagian[0] === "batch" ? "batch" : "obat";
    var obatId = (bagian[0] === "obat" && bagian[1]) ? bagian[1].split("?")[0] : "";
    isi.textContent = "";
    isi.appendChild(judul("Stok", "Stok per obat dan per batch, serta kartu stok."));
    isi.appendChild(tabStok(tab));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    if (obatId) renderKartuObat(area, obatId);
    else if (tab === "batch") renderStokBatch(area);
    else renderStokPerObat(area);
  }

  // Lencana ED: teks bulan + penanda sisa waktu (sama dengan dashboard)
  function lencanaED(tgl) {
    if (!tgl) return el("span", { class: "pudar" }, "tanpa ED");
    var sb = selisihBulan(tgl, new Date());
    var lencana;
    if (sb < 0) lencana = el("span", { class: "lencana bahaya" }, "Lewat");
    else if (sb === 0) lencana = el("span", { class: "lencana peringatan" }, "Bulan ini");
    else lencana = el("span", { class: sb <= 1 ? "lencana peringatan" : "lencana netral" }, sb + " bln");
    return el("span", {}, [document.createTextNode(formatED(tgl) + " "), lencana]);
  }

  // Jadikan baris tabel bisa diklik (dan Enter) → buka kartu stok obat
  function barisBisaKlik(wadahTabel, daftar, ambilObatId) {
    var rows = wadahTabel.querySelectorAll("tbody tr");
    [].forEach.call(rows, function (tr, i) {
      var id = ambilObatId(daftar[i]);
      if (!id) return;
      tr.className = (tr.className ? tr.className + " " : "") + "stok-tr-klik";
      tr.setAttribute("tabindex", "0");
      tr.addEventListener("click", function () { location.hash = "#/stok/obat/" + id; });
      tr.addEventListener("keydown", function (e) {
        if (e.key === "Enter") location.hash = "#/stok/obat/" + id;
      });
    });
  }

  // ----- Tab "Per obat" -----
  function renderStokPerObat(area) {
    var tombolSinkron = el("button", { type: "button", class: "btn btn-garis" }, "⟳ Sinkronkan semua stok");
    var statusSinkron = el("span", { class: "so-recalc-prog" }, "");
    area.appendChild(el("div", { class: "so-recalc-semua-wrap" }, [tombolSinkron, statusSinkron]));
    area.appendChild(el("p", { class: "pudar", style: "margin:4px 0 12px;font-size:13px" },
      "Sinkronkan menghitung ulang stok live semua batch dan obat dari seluruh mutasi. Pakai jika angka tampak tidak cocok."));

    var konten = el("div", {});
    area.appendChild(konten);

    function muat() {
      konten.textContent = "";
      konten.appendChild(el("p", { class: "status-koneksi" }, "Memuat daftar obat..."));
      fetchSemua("daftar_obat", { sort: "kode", filter: "aktif = true", expand: "kategori" }).then(gambar, function (err) {
        tanganiGalat(err, muat, konten);
      });
    }

    tombolSinkron.addEventListener("click", function () {
      if (!window.confirm("Sinkronkan stok semua batch dan obat? Proses bisa beberapa menit.")) return;
      tombolSinkron.disabled = true;
      statusSinkron.textContent = "Memulai...";
      jalankanRecalcGlobal(statusSinkron, function () {
        tombolSinkron.disabled = false;
        muat();
      });
    });

    function gambar(obatList) {
      konten.textContent = "";
      var inpCari = el("input", { type: "search", class: "inp-teks stok-cari", placeholder: "Cari nama atau kode obat...", "aria-label": "Cari obat" });
      var pilFilter = el("select", { class: "stok-pil", "aria-label": "Filter stok" }, [
        el("option", { value: "semua" }, "Semua obat"),
        el("option", { value: "ada" }, "Ada stok"),
        el("option", { value: "nol" }, "Stok nol"),
        el("option", { value: "minus" }, "Stok minus")
      ]);
      var info = el("span", { class: "pudar stok-info" }, "");
      konten.appendChild(el("div", { class: "stok-bilah" }, [inpCari, pilFilter, info]));
      var wadah = el("div", { class: "daftar" });
      konten.appendChild(wadah);

      function stokDari(o) { return Number(o.stok_sistem) || 0; }

      function gambarTabel() {
        var q = inpCari.value.trim().toLowerCase();
        var f = pilFilter.value;
        var tampil = obatList.filter(function (o) {
          var s = stokDari(o);
          if (f === "ada" && s <= 0) return false;
          if (f === "nol" && s !== 0) return false;
          if (f === "minus" && s >= 0) return false;
          if (q && ((o.nama_utama || "") + " " + (o.nama_alias || "") + " " + (o.kode || "")).toLowerCase().indexOf(q) === -1) return false;
          return true;
        });
        wadah.textContent = "";
        info.textContent = formatAngka(tampil.length) + " dari " + formatAngka(obatList.length) + " obat";
        if (!tampil.length) {
          wadah.appendChild(el("p", { class: "status-koneksi" }, "Tidak ada obat yang cocok."));
          return;
        }
        var kolom = [
          { judul: "Kode", isi: function (o) { return el("span", { class: "pudar" }, o.kode || ""); } },
          { judul: "Obat", utama: true, isi: function (o) { return o.nama_utama || o.id; } },
          { judul: "Kategori", isi: function (o) { return lencanaKategori(o.expand && o.expand.kategori); } },
          { judul: "Stok", angka: true, isi: function (o) {
            var s = stokDari(o);
            return el("span", { class: s < 0 ? "ks-negatif" : "" }, formatAngka(s) + " " + (o.satuan || ""));
          } }
        ];
        var tabel = buatTabel(kolom, tampil);
        wadah.appendChild(tabel);
        barisBisaKlik(tabel, tampil, function (o) { return o.id; });
      }

      inpCari.addEventListener("input", gambarTabel);
      pilFilter.addEventListener("change", gambarTabel);
      gambarTabel();
    }

    muat();
  }

  // ----- Tab "Batch" -----
  function renderStokBatch(area) {
    var konten = el("div", {});
    area.appendChild(konten);

    function muat() {
      konten.textContent = "";
      konten.appendChild(el("p", { class: "status-koneksi" }, "Memuat batch..."));
      fetchSemua("batch", { sort: "expired_date", expand: "obat" }).then(gambar, function (err) {
        tanganiGalat(err, muat, konten);
      });
    }

    function gambar(batchList) {
      konten.textContent = "";
      var inpCari = el("input", { type: "search", class: "inp-teks stok-cari", placeholder: "Cari obat atau nomor batch...", "aria-label": "Cari batch" });
      var pilStok = el("select", { class: "stok-pil", "aria-label": "Filter stok batch" }, [
        el("option", { value: "ada" }, "Ada stok"),
        el("option", { value: "semua" }, "Semua batch"),
        el("option", { value: "minus" }, "Stok minus")
      ]);
      var pilED = el("select", { class: "stok-pil", "aria-label": "Filter ED" }, [
        el("option", { value: "semua" }, "Semua ED"),
        el("option", { value: "lewat" }, "Sudah lewat"),
        el("option", { value: "3" }, "≤ 3 bulan"),
        el("option", { value: "6" }, "≤ 6 bulan"),
        el("option", { value: "tanpa" }, "Tanpa ED")
      ]);
      var info = el("span", { class: "pudar stok-info" }, "");
      konten.appendChild(el("div", { class: "stok-bilah" }, [inpCari, pilStok, pilED, info]));
      var wadah = el("div", { class: "daftar" });
      konten.appendChild(wadah);

      function stokDari(b) {
        return Number(b.stok_sistem !== null && b.stok_sistem !== undefined ? b.stok_sistem : (b.stok_awal || 0)) || 0;
      }
      function obatDari(b) { return (b.expand && b.expand.obat) || {}; }

      function gambarTabel() {
        var q = inpCari.value.trim().toLowerCase();
        var fs = pilStok.value, fe = pilED.value;
        var sekarang = new Date();
        var tampil = batchList.filter(function (b) {
          var s = stokDari(b);
          if (fs === "ada" && s <= 0) return false;
          if (fs === "minus" && s >= 0) return false;
          if (fe === "tanpa" && b.expired_date) return false;
          if (fe !== "semua" && fe !== "tanpa") {
            if (!b.expired_date) return false;
            var sb = selisihBulan(b.expired_date, sekarang);
            if (fe === "lewat" && sb >= 0) return false;
            if ((fe === "3" || fe === "6") && sb > Number(fe)) return false;
          }
          if (q) {
            var o = obatDari(b);
            var gabung = ((o.nama_utama || "") + " " + (o.kode || "") + " " + (b.nomor_batch || "")).toLowerCase();
            if (gabung.indexOf(q) === -1) return false;
          }
          return true;
        }).sort(function (a, c) {
          // ED terdekat dulu; tanpa ED paling bawah
          var ea = a.expired_date || "9999", ec = c.expired_date || "9999";
          if (ea !== ec) return ea < ec ? -1 : 1;
          return (obatDari(a).nama_utama || "").localeCompare(obatDari(c).nama_utama || "");
        });

        wadah.textContent = "";
        info.textContent = formatAngka(tampil.length) + " batch";
        if (!tampil.length) {
          wadah.appendChild(el("p", { class: "status-koneksi" }, "Tidak ada batch yang cocok."));
          return;
        }
        var kolom = [
          { judul: "Obat", utama: true, isi: function (b) {
            var o = obatDari(b);
            return el("span", {}, [o.nama_utama || "?", el("span", { class: "pudar" }, o.kode ? " · " + o.kode : "")]);
          } },
          { judul: "Batch", isi: function (b) { return (b.nomor_batch || "").trim() || "(tanpa nomor)"; } },
          { judul: "ED", isi: function (b) { return lencanaED(b.expired_date); } },
          { judul: "Stok", angka: true, isi: function (b) {
            var s = stokDari(b);
            return el("span", { class: s < 0 ? "ks-negatif" : "" }, formatAngka(s) + " " + (obatDari(b).satuan || ""));
          } }
        ];
        var tabel = buatTabel(kolom, tampil);
        wadah.appendChild(tabel);
        barisBisaKlik(tabel, tampil, function (b) { return b.obat; });
      }

      inpCari.addEventListener("input", gambarTabel);
      pilStok.addEventListener("change", gambarTabel);
      pilED.addEventListener("change", gambarTabel);
      gambarTabel();
    }

    muat();
  }

  // ----- Kartu stok satu obat (#/stok/obat/<id>) -----
  function renderKartuObat(area, obatIdAwal) {
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat daftar obat..."));

    fetchSemua("daftar_obat", { sort: "kode", filter: "aktif = true", expand: "kategori" }).then(function (obatList) {
      area.textContent = "";

      var labelSatuan = el("span", { class: "status-koneksi ks-satuan-label" }, "");
      var areaHasil;

      function tampilkan(obat) {
        labelSatuan.textContent = obat.satuan ? "Satuan: " + obat.satuan : "";
        // Perbarui alamat tanpa memicu render ulang halaman
        try { history.replaceState(null, "", "#/stok/obat/" + obat.id); } catch (e) {}
        muatKartuStok(obat, areaHasil);
      }

      var cariEl = buatCariObat(obatList, tampilkan);
      var kembali = el("a", { href: "#/stok", class: "btn btn-garis" }, "← Daftar stok");
      area.appendChild(el("div", { class: "ks-cari-baris" }, [kembali, cariEl, labelSatuan]));

      areaHasil = el("div", { class: "batas-dalam" }, [
        el("p", { class: "status-koneksi" }, "Pilih obat untuk melihat kartu stok.")
      ]);
      area.appendChild(areaHasil);

      var awal = obatList.filter(function (o) { return o.id === obatIdAwal; })[0];
      if (awal) {
        tampilkan(awal);
      } else if (obatIdAwal) {
        // Obat nonaktif atau tidak ada di daftar aktif: ambil langsung
        LPLPO.daftar("daftar_obat", { filter: 'id = "' + obatIdAwal + '"', perPage: 1, expand: "kategori" }).then(function (d) {
          if (d.items && d.items[0]) tampilkan(d.items[0]);
          else areaHasil.textContent = "Obat tidak ditemukan.";
        }, function (err) { tanganiGalat(err, function () { renderKartuObat(area, obatIdAwal); }, areaHasil); });
      }
    }, function (err) {
      tanganiGalat(err, function () { area.textContent = ""; renderKartuObat(area, obatIdAwal); }, area);
    });
  }

  // Sinkronkan stok live SATU obat: batch.stok_sistem tiap batch + daftar_obat.stok_sistem.
  // Rumus sama dengan jalankanRecalcGlobal (stok_awal + Σ mutasi; mutasi tanpa batch dihitung ke obat).
  function sinkronkanStokObat(obatId, lapor) {
    lapor("Mengambil data...");
    return Promise.all([
      fetchSemua("batch", { filter: 'obat = "' + obatId + '"', sort: "id" }),
      fetchSemua("mutasi", { filter: 'obat = "' + obatId + '"', sort: "tanggal" }),
      LPLPO.daftar("daftar_obat", { filter: 'id = "' + obatId + '"', perPage: 1 })
    ]).then(function (h) {
      var batchList = h[0], semuaMutasi = h[1];
      var obat = (h[2].items && h[2].items[0]) || {};
      var deltaBatch = {}, deltaTanpa = 0;
      semuaMutasi.forEach(function (m) {
        var j = Number(m.jumlah) || 0;
        var d = m.jenis === "masuk" ? j : -j;
        if (m.batch) deltaBatch[m.batch] = (deltaBatch[m.batch] || 0) + d;
        else deltaTanpa += d;
      });
      var totalObat = deltaTanpa;
      var antrian = batchList.map(function (bt) {
        return function () {
          var baru = (Number(bt.stok_awal) || 0) + (deltaBatch[bt.id] || 0);
          totalObat += baru;
          if (Math.abs(baru - (Number(bt.stok_sistem) || 0)) < 0.001) return Promise.resolve();
          return LPLPO.ubah("batch", bt.id, { stok_sistem: baru });
        };
      });
      lapor("Memperbarui " + batchList.length + " batch...");
      return antrianSeri(antrian).then(function () {
        lapor("Memperbarui stok obat...");
        if (Math.abs(totalObat - (Number(obat.stok_sistem) || 0)) < 0.001) return null;
        return LPLPO.ubah("daftar_obat", obatId, { stok_sistem: totalObat });
      });
    }).then(function () { lapor("Selesai."); });
  }

  function muatKartuStok(obat, areaHasil) {
    areaHasil.textContent = "";
    areaHasil.appendChild(el("p", { class: "status-koneksi" }, "Memuat transaksi..."));

    // Muat mutasi DAN batch paralel — sisa harus mulai dari total stok_awal
    Promise.all([
      daftarSemua("mutasi", {
        perPage: 200,
        sort: "tanggal,id",
        filter: 'obat = "' + obat.id + '" && status = "confirmed"',
        expand: "unit,batch"
      }),
      daftarSemua("batch", {
        perPage: 200,
        filter: 'obat = "' + obat.id + '"',
        fields: "id,nomor_batch,expired_date,stok_awal,stok_sistem,aktif"
      })
    ]).then(function (hasil) {
      areaHasil.textContent = "";
      var items = hasil[0].items.slice();
      var batchList = hasil[1].items;

      // Hari yang sama: masuk dulu, baru keluar (supaya saldo berjalan tidak minus sementara),
      // sama seperti urutan di detail obat SO. Selanjutnya urut id.
      items.sort(function (a, c) {
        var ta = (a.tanggal || "").slice(0, 10), tc = (c.tanggal || "").slice(0, 10);
        if (ta !== tc) return ta < tc ? -1 : 1;
        var ja = a.jenis === "masuk" ? 0 : 1, jc = c.jenis === "masuk" ? 0 : 1;
        if (ja !== jc) return ja - jc;
        return (a.id || "").localeCompare(c.id || "");
      });

      if (!items.length) {
        areaHasil.appendChild(el("p", { class: "status-koneksi" }, "Belum ada transaksi untuk obat ini."));
        return;
      }

      // Sisa berjalan mulai dari jumlah stok_awal semua batch
      var totalStokAwal = batchList.reduce(function (acc, bt) { return acc + (Number(bt.stok_awal) || 0); }, 0);
      var sisa = totalStokAwal;
      var baris = items.map(function (m) {
        var jenis = m.jenis;
        var jumlah = Number(m.jumlah) || 0;
        if (jenis === "masuk") sisa += jumlah; else sisa -= jumlah;
        var unit  = m.expand && m.expand.unit;
        var batch = m.expand && m.expand.batch;
        return {
          tanggal:      m.tanggal,
          unit_nama:    unit  ? unit.nama           : "—",
          nomor_batch:  batch ? (batch.nomor_batch || "(tanpa nomor)") : (m.batch ? "?" : "Tanpa batch"),
          expired_date: batch ? (batch.expired_date || "") : "",
          masuk:        jenis === "masuk"  ? jumlah : null,
          keluar:       jenis === "keluar" ? jumlah : null,
          sisa:         sisa,
          jenis:        jenis
        };
      });

      // Rincian batch aktif (stok_sistem > 0 atau semua batch)
      var batchAktif = batchList.filter(function (bt) {
        return (bt.stok_sistem !== null && bt.stok_sistem !== undefined ? bt.stok_sistem : (bt.stok_awal || 0)) > 0;
      }).sort(function (a, c) {
        return (a.expired_date || "9999").localeCompare(c.expired_date || "9999");
      });

      // Info ringkas + rincian batch
      var sisaTerakhir = baris[baris.length - 1].sisa;

      // Stok "Tanpa batch" = Σ masuk − Σ keluar dari mutasi yang tidak punya relasi batch
      var saldoTanpa = 0, adaTxTanpa = false;
      items.forEach(function (m) {
        if (m.batch) return;
        adaTxTanpa = true;
        var j = Number(m.jumlah) || 0;
        saldoTanpa += (m.jenis === "masuk") ? j : -j;
      });
      var tampilTanpa = adaTxTanpa || obat.pakai_batch === false;

      var batchRincian;
      if (batchAktif.length || tampilTanpa) {
        var batchRows = batchAktif.map(function (bt) {
          var stok = bt.stok_sistem !== null && bt.stok_sistem !== undefined ? bt.stok_sistem : (bt.stok_awal || 0);
          return el("div", { class: "ks-batch-baris" }, [
            el("span", { class: "ks-batch-no" }, bt.nomor_batch || "(tanpa nomor)"),
            el("span", { class: "pudar ks-batch-ed" }, bt.expired_date ? formatED(bt.expired_date) : "tanpa ED"),
            el("span", { class: "ks-batch-stok" + (stok < 0 ? " ks-negatif" : "") }, formatAngka(stok))
          ]);
        });
        if (tampilTanpa) {
          batchRows.push(el("div", { class: "ks-batch-baris" }, [
            el("span", { class: "ks-batch-no" }, "Tanpa batch"),
            el("span", { class: "pudar ks-batch-ed" }, "—"),
            el("span", { class: "ks-batch-stok" + (saldoTanpa < 0 ? " ks-negatif" : "") }, formatAngka(saldoTanpa))
          ]));
        }
        batchRincian = el("div", { class: "ks-ringkas-item ks-batch-wrap" }, [
          el("span", { class: "ks-ringkas-label" }, "Stok per batch"),
          el("div", { class: "ks-batch-daftar" }, batchRows)
        ]);
      } else {
        batchRincian = el("div", { class: "ks-ringkas-item" }, [
          el("span", { class: "ks-ringkas-label" }, "Stok per batch"),
          el("span", { class: "pudar" }, "Tidak ada batch dengan stok > 0")
        ]);
      }

      var infoRingkas = el("div", { class: "ks-ringkas panel" }, [
        el("div", { class: "ks-ringkas-item" }, [
          el("span", { class: "ks-ringkas-label" }, "Obat"),
          el("span", { class: "ks-ringkas-nilai" }, [
            el("strong", {}, obat.nama_utama),
            el("span", { class: "pudar" }, [
              obat.kode ? " · " + obat.kode : "",
              (obat.expand && obat.expand.kategori) ? " · " + (obat.expand.kategori.nama || obat.expand.kategori.kode) : ""
            ].filter(Boolean).join("") || "")
          ])
        ]),
        el("div", { class: "ks-ringkas-item" }, [
          el("span", { class: "ks-ringkas-label" }, "Sisa stok"),
          el("span", {
            class: "ks-ringkas-nilai ks-sisa-besar" + (sisaTerakhir < 0 ? " ks-negatif" : "")
          }, formatAngka(sisaTerakhir) + " " + (obat.satuan || ""))
        ]),
        batchRincian,
        el("div", { class: "ks-ringkas-item" }, [
          el("span", { class: "ks-ringkas-label" }, "Total transaksi"),
          el("span", { class: "ks-ringkas-nilai" }, String(items.length))
        ])
      ]);

      // Filter tombol
      var filterAktif = "semua";
      var tBody = el("tbody", {});

      function gambarBaris() {
        tBody.textContent = "";

        // Baris saldo awal per batch (hanya yang ada jumlahnya), selalu tampil di atas
        var batchAwal = batchList.filter(function (bt) { return (Number(bt.stok_awal) || 0) > 0; })
          .sort(function (a, c) { return (a.expired_date || "9999").localeCompare(c.expired_date || "9999"); });
        if (batchAwal.length) {
          var sisaAwalKum = 0;
          batchAwal.forEach(function (bt, bi) {
            var stokAwalBt = Number(bt.stok_awal) || 0;
            sisaAwalKum += stokAwalBt;
            tBody.appendChild(el("tr", { class: "ks-tr-awal" }, [
              el("td", { "data-label": "Tanggal", class: "pudar" }, bi === 0 ? "Saldo awal" : ""),
              el("td", { "data-label": "Dokumen" }, ""),
              el("td", { "data-label": "Dari / Ke", class: "pudar" }, ""),
              el("td", { "data-label": "Batch", class: "pudar" }, bt.nomor_batch || "—"),
              el("td", { "data-label": "Kadaluwarsa", class: "pudar" }, bt.expired_date ? formatED(bt.expired_date) : "—"),
              el("td", { "data-label": "Masuk", class: "n ks-masuk" }, formatAngka(stokAwalBt)),
              el("td", { "data-label": "Keluar", class: "n" }, ""),
              el("td", { "data-label": "Sisa Stok", class: "n" }, formatAngka(sisaAwalKum))
            ]));
          });
        } else if (!batchList.length) {
          // Obat tanpa batch — satu baris stok awal total jika ada
          var totalAwal = batchList.reduce(function (a, bt) { return a + (Number(bt.stok_awal) || 0); }, 0);
          if (totalAwal > 0) {
            tBody.appendChild(el("tr", { class: "ks-tr-awal" }, [
              el("td", { "data-label": "Tanggal", class: "pudar" }, "Saldo awal"),
              el("td", {}), el("td", {}), el("td", {}), el("td", {}),
              el("td", { "data-label": "Masuk", class: "n ks-masuk" }, formatAngka(totalAwal)),
              el("td", {}),
              el("td", { "data-label": "Sisa Stok", class: "n" }, formatAngka(totalAwal))
            ]));
          }
        }

        var tampil = filterAktif === "semua" ? baris
          : baris.filter(function (b) { return b.jenis === filterAktif; });

        if (!tampil.length) {
          tBody.appendChild(el("tr", {}, [
            el("td", { colspan: "8", class: "ks-td-kosong" }, "Tidak ada transaksi.")
          ]));
          return;
        }
        tampil.forEach(function (b) {
          tBody.appendChild(el("tr", { class: "ks-tr-" + b.jenis }, [
            el("td", { "data-label": "Tanggal" }, formatTglPendek(b.tanggal)),
            el("td", { "data-label": "Dokumen" }, ""),
            el("td", { "data-label": "Dari / Ke" }, b.unit_nama),
            el("td", { "data-label": "Batch", class: "pudar" }, b.nomor_batch),
            el("td", { "data-label": "Kadaluwarsa", class: "pudar" }, b.expired_date ? formatED(b.expired_date) : "—"),
            el("td", { "data-label": "Masuk", class: "n ks-masuk" }, b.masuk != null ? formatAngka(b.masuk) : ""),
            el("td", { "data-label": "Keluar", class: "n ks-keluar" }, b.keluar != null ? formatAngka(b.keluar) : ""),
            el("td", { "data-label": "Sisa Stok", class: "n" + (b.sisa < 0 ? " ks-negatif" : "") }, (function() {
              // Sisa total (besar) + sisa batch aktif (kecil, pudar)
              var sisaBatchArr = batchAktif.filter(function(bt) {
                // Hitung sisa batch ini dari baris sampai sini
                return bt.nomor_batch === b.nomor_batch || (!bt.nomor_batch && b.nomor_batch === "—");
              });
              var fragEl = document.createDocumentFragment();
              var totalEl = el("span", { class: "ks-sisa-total" }, formatAngka(b.sisa));
              fragEl.appendChild(totalEl);
              // Tampilkan sisa per batch aktif, kecil dan pudar
              if (batchAktif.length + (tampilTanpa ? 1 : 0) > 1) {
                var subEl = el("span", { class: "ks-sisa-batch-sub pudar" });
                // Hitung sisa running per batch sampai baris ini
                var sisaRunBatch = {};
                var sisaRunTanpa = 0; // saldo "Tanpa batch" (mulai 0)
                var allRows = baris.slice(0, baris.indexOf(b) + 1);
                // Init dengan stok awal
                batchList.forEach(function(bt) { sisaRunBatch[bt.id] = Number(bt.stok_awal) || 0; });
                // Update dengan mutasi sampai baris ini
                items.slice(0, baris.indexOf(b) + 1).forEach(function(m) {
                  var j = Number(m.jumlah) || 0;
                  if (!m.batch) { sisaRunTanpa += (m.jenis === "masuk") ? j : -j; return; }
                  if (m.jenis === "masuk") sisaRunBatch[m.batch] = (sisaRunBatch[m.batch] || 0) + j;
                  else sisaRunBatch[m.batch] = (sisaRunBatch[m.batch] || 0) - j;
                });
                var teksSub = [];
                batchAktif.forEach(function(bt) {
                  var s = sisaRunBatch[bt.id];
                  if (s == null) return;
                  teksSub.push((bt.nomor_batch || "(tanpa nomor)") + ": " + formatAngka(s));
                });
                if (tampilTanpa) teksSub.push("Tanpa batch: " + formatAngka(sisaRunTanpa));
                subEl.appendChild(el("span", {}, teksSub.join(" · ")));
                fragEl.appendChild(subEl);
              }
              return fragEl;
            })())
          ]));
        });
      }

      function buatBtnFilter(val, label) {
        var btn = el("button", {
          type: "button",
          class: "btn btn-garis ks-filter-btn" + (val === filterAktif ? " ks-filter-aktif" : "")
        }, label);
        btn.addEventListener("click", function () {
          filterAktif = val;
          filterBar.querySelectorAll(".ks-filter-btn").forEach(function (b) {
            b.classList.toggle("ks-filter-aktif", b === btn);
          });
          gambarBaris();
        });
        return btn;
      }

      var filterBar = el("div", { class: "ks-filter-bar" }, [
        buatBtnFilter("semua", "Semua"),
        buatBtnFilter("masuk", "Masuk"),
        buatBtnFilter("keluar", "Keluar")
      ]);

      // Tabel — 8 kolom termasuk Dokumen (kosong)
      var thead = el("thead", {}, [
        el("tr", {}, [
          el("th", {}, "Tanggal"),
          el("th", {}, "Dokumen"),
          el("th", {}, "Dari / Ke"),
          el("th", {}, "Batch"),
          el("th", {}, "Kadaluwarsa"),
          el("th", { class: "n" }, "Masuk"),
          el("th", { class: "n" }, "Keluar"),
          el("th", { class: "n" }, "Sisa Stok")
        ])
      ]);

      gambarBaris();

      var tabel = el("div", { class: "daftar ks-tabel-bungkus" }, [
        el("div", { class: "tabel-gulir" }, [
          el("table", { class: "kartu" }, [thead, tBody])
        ])
      ]);

      // Tombol sinkron stok live untuk obat ini (batch.stok_sistem + daftar_obat.stok_sistem)
      var tombolSinkronObat = el("button", { type: "button", class: "btn btn-garis" }, "⟳ Sinkronkan stok obat ini");
      var statusSinkronObat = el("span", { class: "so-recalc-prog" }, "");
      tombolSinkronObat.addEventListener("click", function () {
        tombolSinkronObat.disabled = true;
        sinkronkanStokObat(obat.id, function (t) { statusSinkronObat.textContent = t; }).then(function () {
          muatKartuStok(obat, areaHasil);
        }, function (err) {
          statusSinkronObat.textContent = "Gagal: " + ((err && (err.pesan || err.message)) || "kesalahan tak dikenal");
          tombolSinkronObat.disabled = false;
        });
      });
      var barisSinkron = el("div", { class: "ks-aksi" }, [tombolSinkronObat, statusSinkronObat]);

      areaHasil.append(infoRingkas, barisSinkron, filterBar, tabel);

    }, function (err) {
      tanganiGalat(err, function () { muatKartuStok(obat, areaHasil); }, areaHasil);
    });
  }

  // ---------- Halaman: Histori mutasi ----------
  // Mode LIST: list tanggal expandable → per unit expandable → tabel item
  // Mode TABEL: satu tabel besar semua mutasi (Excel-like), bisa difilter
  // #/histori?unit=X&tgl=Y → auto-expand tanggal+unit yg sesuai
  function renderHistori() {
    isi.textContent = "";
    isi.appendChild(judul("Histori mutasi", "Riwayat transaksi. Klik tanggal untuk lihat detail."));

    // Baca query dari hash URL
    var hashQ = (location.hash || "").split("?")[1] || "";
    var qp = {};
    hashQ.split("&").forEach(function (kv) {
      var p = kv.split("="); if (p[0]) qp[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });

    var area = el("div", { class: "hist-area" });
    isi.appendChild(area);

    // ---- Toolbar: filter + toggle mode ----
    var pilUnit = el("select", { class: "hist-sel-unit", "aria-label": "Filter unit" });
    pilUnit.appendChild(el("option", { value: "" }, "Semua unit"));
    LPLPO.daftar("unit", { perPage: 100, sort: "nama" }).then(function (d) {
      d.items.forEach(function (u) { pilUnit.appendChild(el("option", { value: u.id }, u.nama)); });
      if (qp.unit) pilUnit.value = qp.unit;
    });

    var pilJenis = el("select", { class: "hist-sel-jenis", "aria-label": "Filter jenis" });
    [["", "Semua"], ["masuk", "Masuk"], ["keluar", "Keluar"]].forEach(function (j) {
      pilJenis.appendChild(el("option", { value: j[0] }, j[1]));
    });

    // Filter tanggal: default bulan ini, bisa ganti ke rentang custom
    var today = new Date();
    var bulanDefault = today.getFullYear() + "-" + String(today.getMonth()+1).padStart(2,"0");
    var tglDariDefault = bulanDefault + "-01";
    var lastDay = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
    var tglSampaiDefault = bulanDefault + "-" + String(lastDay).padStart(2,"0");

    var modeRentang = false; // false = bulan, true = rentang custom

    var inpBulan = el("input", { type: "month", class: "hist-inp-bulan",
      value: bulanDefault });

    var tglDariObj = buatInputTanggal(tglDariDefault, function(){}, { label: "Dari" });
    var tglSampaiObj = buatInputTanggal(tglSampaiDefault, function(){}, { label: "Sampai" });

    var labelBulan = el("label", { class: "hist-toolbar-label" }, [
      el("span", { class: "pudar" }, "Bulan"), inpBulan
    ]);
    var labelRentang = el("div", { class: "hist-toolbar-rentang hist-hidden" }, [
      el("label", { class: "hist-toolbar-label" }, [el("span", { class: "pudar" }, "Dari"), tglDariObj.el]),
      el("label", { class: "hist-toolbar-label" }, [el("span", { class: "pudar" }, "Sampai"), tglSampaiObj.el])
    ]);

    var tombolRentang = el("button", { type: "button", class: "hist-btn-rentang", title: "Pilih rentang tanggal custom" });
    tombolRentang.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg> Rentang';
    tombolRentang.addEventListener("click", function() {
      modeRentang = !modeRentang;
      labelBulan.classList.toggle("hist-hidden", modeRentang);
      labelRentang.classList.toggle("hist-hidden", !modeRentang);
      tombolRentang.classList.toggle("hist-btn-rentang-aktif", modeRentang);
    });

    var modeSaatIni = "list"; // "list" | "tabel"
    var tombolMode = el("button", { type: "button", class: "btn btn-garis hist-btn-mode" }, "☰ Tabel penuh");

    var tombolMuat = el("button", { type: "button", class: "btn btn-sekunder" }, "Tampilkan");

    var toolbar = el("div", { class: "hist-toolbar" }, [
      labelBulan,
      labelRentang,
      tombolRentang,
      el("label", { class: "hist-toolbar-label" }, [el("span", { class: "pudar" }, "Unit"), pilUnit]),
      el("label", { class: "hist-toolbar-label" }, [el("span", { class: "pudar" }, "Jenis"), pilJenis]),
      tombolMuat,
      el("span", { class: "hist-toolbar-sep" }),
      tombolMode
    ]);
    area.appendChild(toolbar);

    var konten = el("div", { class: "hist-konten" });
    area.appendChild(konten);

    // ---- Modal edit mutasi ----
    function buatModalEditMutasi(m, obatE, batchE, unitE, onSelesai) {
      var overlay = el("div", { class: "modal-overlay", role: "dialog", "aria-modal": "true", "aria-label": "Edit mutasi" });
      function tutup() { overlay.remove(); }
      overlay.addEventListener("click", function (e) { if (e.target === overlay) tutup(); });
      overlay.addEventListener("keydown", function (e) { if (e.key === "Escape") tutup(); });

      var kotak = el("div", { class: "modal-kotak" });
      overlay.appendChild(kotak);

      var namaObat = obatE ? (obatE.nama_utama || obatE.kode || "?") : "?";
      var namaUnit = unitE.nama || "?";
      var namaJenis = m.jenis === "masuk" ? "Masuk" : "Keluar";
      var namaBatch = batchE ? (batchE.nomor_batch || "tanpa nomor") + (batchE.expired_date ? " · " + formatED(batchE.expired_date) : "") : "—";

      kotak.appendChild(el("div", { class: "modal-judul" }, [
        el("strong", {}, "Edit mutasi"),
        (function () { var t = el("button", { type: "button", class: "modal-tutup", "aria-label": "Tutup" }, "✕"); t.addEventListener("click", tutup); return t; })()
      ]));

      var pesan = el("p", { class: "pesan", hidden: true });

      var tglObj = buatInputTanggal(m.tanggal, function () {}, { label: "Tanggal" });
      var inpJumlah = el("input", { type: "number", id: "med-jumlah", class: "mob-inp", min: "1", step: "1", value: String(m.jumlah), inputmode: "numeric" });
      var inpKet = el("input", { type: "text", id: "med-ket", class: "mob-inp", value: m.keterangan || "", placeholder: "Keterangan (opsional)" });

      var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan perubahan");

      kotak.appendChild(el("div", { class: "mob-form" }, [
        pesan,
        el("p", { class: "med-info" }, [
          el("span", { class: "med-label" }, namaJenis + " · "),
          el("span", {}, namaObat),
          el("span", { class: "med-label" }, " · " + namaUnit),
          namaBatch !== "—" ? el("span", { class: "med-label" }, " · Batch " + namaBatch) : el("span", {})
        ]),
        el("div", { class: "field" }, [el("label", { "for": "med-tgl" }, "Tanggal"), tglObj.el]),
        el("div", { class: "field" }, [el("label", { "for": "med-jumlah" }, "Jumlah"), inpJumlah]),
        el("div", { class: "field" }, [el("label", { "for": "med-ket" }, "Keterangan"), inpKet]),
        el("div", { class: "mob-aksi" }, [tombolSimpan])
      ]));

      tombolSimpan.addEventListener("click", function () {
        var tglBaru = tglObj.getValue();
        var jumlahBaru = parseInt(inpJumlah.value, 10);
        if (!tglBaru || isNaN(jumlahBaru) || jumlahBaru < 1) {
          pesan.textContent = "Tanggal dan jumlah wajib diisi.";
          pesan.className = "pesan galat"; pesan.hidden = false;
          return;
        }
        tombolSimpan.disabled = true; tombolSimpan.textContent = "Menyimpan...";
        var jumlahLama = m.jumlah || 0;
        var selisih = jumlahBaru - jumlahLama; // selisih jumlah (bisa negatif)
        LPLPO.ubah("mutasi", m.id, {
          tanggal: tglBaru,
          jumlah: jumlahBaru,
          keterangan: inpKet.value.trim()
        }).then(function () {
          // Update stok_sistem batch dan obat berdasarkan selisih
          var obatId = m.obat || (obatE && obatE.id);
          var batchId = m.batch || (batchE && batchE.id);
          var deltaObat = m.jenis === "masuk" ? selisih : -selisih;
          var pBatch = batchId ? (function () {
            var s = LPLPO.sesi() || {};
            return fetch(window.LPLPO_CONFIG.API + "/api/collections/batch/records/" + batchId, {
              headers: { Authorization: s.token || "" }
            }).then(function (r) { return r.json(); }).then(function (bt) {
              var stokLama = bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : (bt.stok_awal || 0);
              var deltaBatch = m.jenis === "masuk" ? selisih : -selisih;
              return LPLPO.ubah("batch", batchId, { stok_sistem: stokLama + deltaBatch });
            });
          })() : Promise.resolve();
          return pBatch.then(function () {
            return obatId ? updateStokObat(obatId, deltaObat) : Promise.resolve();
          });
        }).then(function () {
          tutup();
          onSelesai();
        }, function (err) {
          pesan.textContent = err.pesan || "Gagal menyimpan.";
          pesan.className = "pesan galat"; pesan.hidden = false;
          tombolSimpan.disabled = false; tombolSimpan.textContent = "Simpan perubahan";
        });
      });

      document.body.appendChild(overlay);
      setTimeout(function () { inpJumlah.focus(); inpJumlah.select(); }, 50);
    }

    // ---- Render tabel item (dipakai di kedua mode) ----
    // modeDetail: true = tabel penuh (semua kolom); false = ringkas di dalam list
    function buatTabelItem(items, unitMap, modeDetail) {
      var ikonHapusSVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
      var ikonEditSVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

      var tbody = el("tbody");
      items.forEach(function (m) {
        var obatE = m.expand && m.expand.obat;
        var batchE = m.expand && m.expand.batch;
        var unitE = unitMap[m.unit] || {};
        var jenisMasuk = m.jenis === "masuk";

        var btnHapus = el("button", { type: "button", class: "hist-btn-hapus", "aria-label": "Hapus mutasi ini", title: "Hapus" });
        btnHapus.innerHTML = ikonHapusSVG;
        btnHapus.addEventListener("click", function () {
          if (!confirm("Hapus mutasi ini?")) return;
          btnHapus.disabled = true;
          var obatId = m.obat || (obatE && obatE.id);
          var batchId = m.batch || (batchE && batchE.id);
          var jumlahM = m.jumlah || 0;
          LPLPO.hapus("mutasi", m.id).then(function () {
            // Reverse stok: masuk yang dihapus → kurangi, keluar yang dihapus → tambahkan
            var deltaObat = m.jenis === "masuk" ? -jumlahM : jumlahM;
            var pBatch = batchId ? (function () {
              var s = LPLPO.sesi() || {};
              return fetch(window.LPLPO_CONFIG.API + "/api/collections/batch/records/" + batchId, {
                headers: { Authorization: s.token || "" }
              }).then(function (r) { return r.json(); }).then(function (bt) {
                var stokLama = bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : (bt.stok_awal || 0);
                var deltaBatch = m.jenis === "masuk" ? -jumlahM : jumlahM;
                return LPLPO.ubah("batch", batchId, { stok_sistem: stokLama + deltaBatch });
              });
            })() : Promise.resolve();
            return pBatch.then(function () {
              return obatId ? updateStokObat(obatId, deltaObat) : Promise.resolve();
            });
          }).then(muat, function () { btnHapus.disabled = false; alert("Gagal menghapus."); });
        });

        var btnEdit = el("button", { type: "button", class: "hist-btn-edit", "aria-label": "Edit mutasi ini", title: "Edit" });
        btnEdit.innerHTML = ikonEditSVG;
        btnEdit.addEventListener("click", function () {
          buatModalEditMutasi(m, obatE, batchE, unitE, function () { muat(); });
        });

        var tdMasuk = el("td", { "data-label": "Masuk", class: "n" });
        var tdKeluar = el("td", { "data-label": "Keluar", class: "n" });
        if (jenisMasuk) {
          tdMasuk.appendChild(el("span", { class: "hist-masuk" }, formatAngka(m.jumlah)));
        } else {
          tdKeluar.appendChild(el("span", { class: "hist-keluar" }, formatAngka(m.jumlah)));
        }

        // Helper: buat nama obat td dengan kode + nama terpotong max 30 char
        function buatTdObat(obatE) {
          var td = el("td", { "data-label": "Obat" });
          if (!obatE) { td.appendChild(el("span", {}, "?")); return td; }
          var wrap = el("span", { class: "hist-obat-wrap" });
          if (obatE.kode) {
            wrap.appendChild(el("span", { class: "hist-obat-kode" }, obatE.kode));
          }
          var nama = obatE.nama_utama || obatE.kode || "?";
          var namaTampil = nama.length > 30 ? nama.slice(0, 30) + "…" : nama;
          var namaEl = el("span", { class: "hist-obat-nama" }, namaTampil);
          if (nama.length > 30) namaEl.title = nama;
          wrap.appendChild(namaEl);
          td.appendChild(wrap);
          return td;
        }

        // Helper: buat td Actions (edit, hapus, opsional ℹ️ jika ada keterangan)
        function buatTdAksi(ket) {
          var btns = [btnEdit, btnHapus];
          if (ket) {
            var btnInfo = el("button", { type: "button", class: "hist-btn-info", title: ket, "aria-label": "Keterangan: " + ket });
            btnInfo.textContent = "ℹ️";
            btns = [btnInfo].concat(btns);
          }
          var inner = el("div", { class: "hist-td-aksi-inner" }, btns);
          return el("td", { class: "hist-td-aksi" }, [inner]);
        }

        if (modeDetail) {
          // Mode tabel penuh: semua kolom
          var batchStr = batchE ? (batchE.nomor_batch || batchE.no_batch || "—") : "—";
          var edStr = batchE && batchE.expired_date ? formatED(batchE.expired_date) : "—";
          var sisaBatch = batchE && batchE.stok_sistem != null ? formatAngka(batchE.stok_sistem) : "—";
          var sisaObat = obatE && obatE.stok_sistem != null ? formatAngka(obatE.stok_sistem) : "—";
          var tdBatch = el("td", { "data-label": "Batch", class: "pudar hist-td-batch" }, batchStr);
          tbody.appendChild(el("tr", {}, [
            el("td", { "data-label": "Tgl", class: "pudar hist-td-tgl" }, formatTglPendek(m.tanggal)),
            el("td", { "data-label": "Unit", class: "pudar hist-td-unit" }, unitE.nama || "?"),
            buatTdObat(obatE),
            tdBatch,
            el("td", { "data-label": "ED", class: "pudar hist-td-ed" }, edStr),
            tdMasuk,
            tdKeluar,
            el("td", { "data-label": "Sisa batch", class: "n pudar" }, sisaBatch),
            el("td", { "data-label": "Sisa Stok", class: "n" }, sisaObat),
            buatTdAksi(m.keterangan)
          ]));
        } else {
          // Mode list (ringkas): deteksi jenis dari item, hanya tampilkan kolom Jumlah
          var tdJumlah = el("td", { "data-label": "Jumlah", class: "n" });
          if (jenisMasuk) {
            tdJumlah.appendChild(el("span", { class: "hist-masuk" }, formatAngka(m.jumlah)));
          } else {
            tdJumlah.appendChild(el("span", { class: "hist-keluar" }, formatAngka(m.jumlah)));
          }
          var batchListStr = batchE ? (batchE.nomor_batch || "—") : "—";
          var edListStr = batchE && batchE.expired_date ? formatED(batchE.expired_date) : "—";
          var tdBatchList = el("td", { "data-label": "Batch", class: "pudar hist-td-batch" }, batchListStr);
          tbody.appendChild(el("tr", {}, [
            buatTdObat(obatE),
            tdBatchList,
            el("td", { "data-label": "ED", class: "pudar hist-td-ed" }, edListStr),
            tdJumlah,
            buatTdAksi(m.keterangan)
          ]));
        }
      });

      if (modeDetail) {
        return el("table", { class: "tabel hist-tabel hist-tabel-border hist-tabel-penuh" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { class: "hist-td-tgl" }, "Tgl"), el("th", { class: "hist-td-unit" }, "Unit"), el("th", { class: "hist-th-obat" }, "Obat"),
            el("th", { class: "hist-td-batch" }, "Batch"), el("th", { class: "hist-td-ed" }, "ED"),
            el("th", { class: "n" }, "Masuk"), el("th", { class: "n" }, "Keluar"),
            el("th", { class: "n" }, "Sisa\nbatch"),
            el("th", { class: "n" }, "Sisa\nStok"),
            el("th", { class: "hist-th-aksi" }, "")
          ])]),
          tbody
        ]);
      } else {
        return el("table", { class: "tabel hist-tabel hist-tabel-border" }, [
          el("thead", {}, [el("tr", {}, [
            el("th", { class: "hist-th-obat" }, "Obat"), el("th", {}, "Batch"), el("th", {}, "ED"),
            el("th", { class: "n" }, "Jumlah"),
            el("th", { class: "hist-th-aksi" }, "Actions")
          ])]),
          tbody
        ]);
      }
    }

    // ---- Mode LIST: tanggal → unit → item ----
    function renderList(items, unitMap, autoExpandTgl, autoExpandUnit) {
      // Group by tanggal (sort desc)
      var byTgl = {}; var urutTgl = [];
      items.forEach(function (m) {
        if (!byTgl[m.tanggal]) { byTgl[m.tanggal] = {}; urutTgl.push(m.tanggal); }
        var uid = m.unit;
        if (!byTgl[m.tanggal][uid]) byTgl[m.tanggal][uid] = [];
        byTgl[m.tanggal][uid].push(m);
      });
      // Dedup + sort desc
      urutTgl = urutTgl.filter(function (v, i, a) { return a.indexOf(v) === i; })
        .sort(function (a, b) { return b.localeCompare(a); });

      var ikonPlusSVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      var ikonPrintSVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

      var listEl = el("div", { class: "hist-list" });

      urutTgl.forEach(function (tgl) {
        var unitIds = Object.keys(byTgl[tgl]);

        // Baris tanggal (level 1, bisa diklik expand)
        var expanded = tgl === autoExpandTgl;
        var ikonEl = el("span", { class: "hist-ikon-expand" }, expanded ? "▾" : "▸");
        var ringkasanHari = el("span", { class: "pudar hist-hari-ringkasan" },
          unitIds.length + " kegiatan");

        // Tools di baris tanggal: tombol Tambah penerimaan + Print
        var btnTambahHari = el("button", { type: "button", class: "hist-btn-tool", title: "Tambah penerimaan untuk tanggal ini", "aria-label": "Tambah penerimaan" });
        btnTambahHari.innerHTML = ikonPlusSVG;
        btnTambahHari.addEventListener("click", function (e) {
          e.stopPropagation();
          location.hash = "#/penerimaan?tgl=" + encodeURIComponent(tgl);
        });
        var btnPrintHari = el("button", { type: "button", class: "hist-btn-tool", title: "Print hari ini (segera hadir)", "aria-label": "Print", disabled: true });
        btnPrintHari.innerHTML = ikonPrintSVG;
        btnPrintHari.style.opacity = "0.3";
        var toolsHari = el("div", { class: "hist-header-tools" }, [btnTambahHari, btnPrintHari]);

        var barisTgl = el("button", { type: "button", class: "hist-baris-tgl" }, [
          ikonEl,
          el("span", { class: "hist-tgl-label" }, formatTglPanjang(tgl)),
          ringkasanHari
        ]);
        // Sisipkan tools secara terpisah (bukan child button) — pakai wrapper flex
        var barisTglWrap = el("div", { class: "hist-baris-tgl-wrap" }, [barisTgl, toolsHari]);

        var kontenTgl = el("div", { class: "hist-konten-tgl" + (expanded ? "" : " hist-collapsed") });

        barisTgl.addEventListener("click", function () {
          expanded = !expanded;
          ikonEl.textContent = expanded ? "▾" : "▸";
          kontenTgl.classList.toggle("hist-collapsed", !expanded);
        });

        // Level 2: per unit
        unitIds.forEach(function (uid) {
          var unitObj = unitMap[uid] || {};
          var grup = byTgl[tgl][uid];
          var jenis = grup[0] && grup[0].jenis;
          var badgeKls = jenis === "masuk" ? "hist-badge-masuk" : "hist-badge-keluar";
          var badgeTeks = jenis === "masuk" ? "Penerimaan" : "Pengeluaran";
          var jmlItem = grup.length + " item";

          var expandedUnit = tgl === autoExpandTgl && uid === autoExpandUnit;
          var ikonUnit = el("span", { class: "hist-ikon-expand" }, expandedUnit ? "▾" : "▸");

          // Tools di baris unit: tombol Tambah (ke form sesuai jenis) + Print
          var btnTambahUnit = el("button", { type: "button", class: "hist-btn-tool",
            title: jenis === "masuk" ? "Tambah penerimaan untuk unit ini" : "Tambah pengeluaran untuk unit ini",
            "aria-label": "Tambah" });
          btnTambahUnit.innerHTML = ikonPlusSVG;
          btnTambahUnit.addEventListener("click", function (e) {
            e.stopPropagation();
            var halaman = jenis === "masuk" ? "penerimaan" : "pengeluaran";
            location.hash = "#/" + halaman + "?unit=" + encodeURIComponent(uid) + "&tgl=" + encodeURIComponent(tgl);
          });
          var btnPrintUnit = el("button", { type: "button", class: "hist-btn-tool", title: "Cetak tanda terima", "aria-label": "Cetak" });
          btnPrintUnit.innerHTML = ikonPrintSVG;
          (function (grpSnap, tglSnap, unitSnap, jenisSnap) {
            btnPrintUnit.addEventListener("click", function (e) {
              e.stopPropagation();
              cetakTandaTerimaHistori(grpSnap, tglSnap, unitSnap, jenisSnap);
            });
          })(grup, tgl, unitObj, jenis);
          var toolsUnit = el("div", { class: "hist-header-tools" }, [btnTambahUnit, btnPrintUnit]);

          var barisUnitBtn = el("button", { type: "button", class: "hist-baris-unit" }, [
            ikonUnit,
            el("span", { class: "hist-unit-nama" }, unitObj.nama || uid),
            el("span", { class: "hist-badge " + badgeKls }, badgeTeks),
            el("span", { class: "pudar hist-unit-ringkasan" }, jmlItem)
          ]);
          var barisUnitWrap = el("div", { class: "hist-baris-unit-wrap" }, [barisUnitBtn, toolsUnit]);

          var kontenUnit = el("div", { class: "hist-konten-unit" + (expandedUnit ? "" : " hist-collapsed") });
          kontenUnit.appendChild(buatTabelItem(grup, unitMap, false));

          barisUnitBtn.addEventListener("click", function () {
            expandedUnit = !expandedUnit;
            ikonUnit.textContent = expandedUnit ? "▾" : "▸";
            kontenUnit.classList.toggle("hist-collapsed", !expandedUnit);
          });

          kontenTgl.appendChild(barisUnitWrap);
          kontenTgl.appendChild(kontenUnit);
        });

        listEl.appendChild(barisTglWrap);
        listEl.appendChild(kontenTgl);
      });

      return listEl;
    }

    // ---- Mode TABEL PENUH ----
    function renderTabelPenuh(items, unitMap) {
      var wrap = el("div", { class: "hist-tabel-wrap" });
      wrap.appendChild(buatTabelItem(items, unitMap, true));
      wrap.appendChild(el("p", { class: "status-koneksi" }, formatAngka(items.length) + " baris."));
      return wrap;
    }

    // ---- Muat data ----
    function muat() {
      konten.textContent = "";
      konten.appendChild(el("p", { class: "status-koneksi" }, "Memuat..."));

      var filterArr = [];
      if (modeRentang) {
        var dari = tglDariObj.getValue();
        var sampai = tglSampaiObj.getValue();
        if (dari)   filterArr.push('tanggal >= "' + dari + '"');
        if (sampai) filterArr.push('tanggal <= "' + sampai + '"');
      } else {
        var bulanVal = inpBulan.value; // "YYYY-MM"
        if (bulanVal) {
          var parts = bulanVal.split("-");
          var y = parts[0], m2 = parts[1];
          var lastDayM = new Date(Number(y), Number(m2), 0).getDate();
          filterArr.push('tanggal >= "' + y + "-" + m2 + '-01"');
          filterArr.push('tanggal <= "' + y + "-" + m2 + "-" + String(lastDayM).padStart(2,"0") + '"');
        }
      }
      if (pilUnit.value)  filterArr.push('unit = "' + pilUnit.value + '"');
      if (pilJenis.value) filterArr.push('jenis = "' + pilJenis.value + '"');

      Promise.all([
        LPLPO.daftar("mutasi", {
          perPage: 1000, sort: "tanggal,created",
          filter: filterArr.join(" && "),
          expand: "obat,unit,batch,obat.kategori"
        }),
        LPLPO.daftar("unit", { perPage: 100, sort: "nama" })
      ]).then(function (hasil) {
        var mutasiItems = hasil[0].items;
        var unitMap = {};
        hasil[1].items.forEach(function (u) { unitMap[u.id] = u; });

        konten.textContent = "";
        if (!mutasiItems.length) {
          konten.appendChild(el("p", { class: "status-koneksi" }, "Tidak ada mutasi untuk filter ini."));
          return;
        }

        if (modeSaatIni === "tabel") {
          konten.appendChild(renderTabelPenuh(mutasiItems, unitMap));
        } else {
          konten.appendChild(renderList(mutasiItems, unitMap, qp.tgl || "", qp.unit || ""));
          // Reset qp setelah sekali auto-expand agar navigasi berikutnya tidak auto-expand lagi
          qp = {};
        }
      }, function (err) { tanganiGalat(err, muat, konten); });
    }

    tombolMuat.addEventListener("click", muat);
    tombolMode.addEventListener("click", function () {
      modeSaatIni = modeSaatIni === "list" ? "tabel" : "list";
      tombolMode.textContent = modeSaatIni === "list" ? "☰ Tabel penuh" : "≡ Mode list";
      muat();
    });

    muat();
  }

  // ---------- Halaman: Pengaturan ----------
  function tabPengaturan(aktif) {
    var nav = el("nav", { class: "tab", "aria-label": "Pengaturan" });
    [["umum", "Umum"], ["master", "Master data"]].forEach(function (t) {
      var a = el("a", { href: "#/pengaturan/" + t[0] }, t[1]);
      if (t[0] === aktif) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    return nav;
  }

  function renderPengaturan(sub) {
    if (!sub || sub === "") sub = "umum";
    isi.textContent = "";
    isi.appendChild(judul("Pengaturan", "Konfigurasi aplikasi dan pengelolaan master data."));
    // Tab utama: highlight "master" jika sub adalah master atau master/xxx
    var tabAktif = sub === "umum" ? "umum" : "master";
    isi.appendChild(tabPengaturan(tabAktif));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    if (sub === "master") {
      renderMasterDiArea(area, "obat");
    } else if (sub.indexOf("master/") === 0) {
      var subSub = sub.slice("master/".length);
      renderMasterDiArea(area, subSub);
    } else {
      renderPengaturanUmum(area);
    }
  }

  function renderPengaturanUmum(area) {
    // Tombol sinkron stok sudah dipindah ke menu Stok (satu jalur saja)
    var panelInfoStok = el("section", { class: "panel" }, [
      el("h2", { style: "margin-top:0" }, "Sinkronkan stok"),
      el("p", { style: "margin:0" }, [
        document.createTextNode("Tombol sinkron stok sekarang ada di menu "),
        el("a", { href: "#/stok" }, "Stok"),
        document.createTextNode(" (semua obat) dan di kartu stok tiap obat (satu obat).")
      ])
    ]);
    area.appendChild(panelInfoStok);

    // Panel pengaturan tampilan
    var KUNCI_BULAN = "lplpo_expired_bulan";
    var nBulan;
    try { nBulan = parseInt(localStorage.getItem(KUNCI_BULAN), 10) || 3; } catch(e) { nBulan = 3; }

    var panelTampilan = el("section", { class: "panel", style: "margin-top:16px" });
    panelTampilan.appendChild(el("h2", { style: "margin-top:0" }, "Preferensi tampilan"));

    var lblBulan = el("label", { "for": "pref-bulan" }, "Tampilkan batch expired dalam ");
    var inpBulan = el("input", { type: "number", id: "pref-bulan", class: "db-exp-n", value: String(nBulan), min: "1", max: "24" });
    var lblBulan2 = el("span", {}, " bulan ke depan (di Dashboard)");
    var barisBulan = el("div", { class: "pref-baris", style: "margin-top:10px" }, [lblBulan, inpBulan, lblBulan2]);
    var simpanTampilan = el("button", { type: "button", class: "btn btn-garis", style: "margin-top:10px" }, "Simpan");
    var statusTampilan = el("span", { class: "status-koneksi", style: "margin-left:10px" }, "");
    panelTampilan.appendChild(barisBulan);
    panelTampilan.appendChild(el("div", {}, [simpanTampilan, statusTampilan]));
    area.appendChild(panelTampilan);

    simpanTampilan.addEventListener("click", function () {
      var v = parseInt(inpBulan.value, 10);
      if (!v || v < 1) v = 1;
      if (v > 24) v = 24;
      inpBulan.value = v;
      try { localStorage.setItem(KUNCI_BULAN, String(v)); } catch(e) {}
      statusTampilan.textContent = "Tersimpan.";
      setTimeout(function () { statusTampilan.textContent = ""; }, 2000);
    });
  }

  // Fetch semua halaman dari satu collection (handle pagination PocketBase)
  function fetchSemua(koleksi, opts) {
    var hasil = [];
    function ambilHal(hal) {
      var o = Object.assign({}, opts, { page: hal, perPage: 500 });
      return LPLPO.daftar(koleksi, o).then(function (d) {
        hasil = hasil.concat(d.items);
        if (hal < d.totalPages) return ambilHal(hal + 1);
        return hasil;
      });
    }
    return ambilHal(1);
  }

  // Recalc global: update batch.stok_sistem (live) + daftar_obat.stok_sistem dari semua mutasi
  // TIDAK mempengaruhi stockopname_item.stok_cutoff
  function jalankanRecalcGlobal(statusEl, selesai) {
    function tulis(t) { statusEl.textContent = t; }

    tulis("Mengambil semua mutasi...");
    Promise.all([
      fetchSemua("batch", { sort: "id" }),
      fetchSemua("mutasi", { sort: "tanggal" })
    ]).then(function (hasil) {
      var semuaBatch  = hasil[0];
      var semuaMutasi = hasil[1];
      tulis("Diterima: " + semuaBatch.length + " batch, " + semuaMutasi.length + " mutasi. Menghitung...");

      // Delta per batch dan per obat (mutasi tanpa batch)
      var deltaPerBatch = {};  // batchId → delta
      var deltaPerObat  = {};  // obatId  → delta (mutasi tanpa batch)

      semuaMutasi.forEach(function (m) {
        var j = Number(m.jumlah) || 0;
        var delta = m.jenis === "masuk" ? j : -j;
        if (m.batch) {
          deltaPerBatch[m.batch] = (deltaPerBatch[m.batch] || 0) + delta;
        } else if (m.obat) {
          deltaPerObat[m.obat] = (deltaPerObat[m.obat] || 0) + delta;
        }
      });

      // Update batch.stok_sistem (nilai live) + akumulasi stok per obat
      var stokObat = {}; // obatId → total dari semua batch
      var n = 0;

      var antrianBatch = semuaBatch.map(function (bt) {
        return function () {
          var stokBaru = (Number(bt.stok_awal) || 0) + (deltaPerBatch[bt.id] || 0);
          var obatId = bt.obat || bt.daftar_obat;
          if (obatId) stokObat[obatId] = (stokObat[obatId] || 0) + stokBaru;
          n++;
          if (n % 10 === 0) tulis("Batch: " + n + "/" + semuaBatch.length + "...");
          if (Math.abs(stokBaru - (Number(bt.stok_sistem) || 0)) < 0.001) return Promise.resolve();
          return LPLPO.ubah("batch", bt.id, { stok_sistem: stokBaru });
        };
      });

      tulis("Mengupdate " + semuaBatch.length + " batch...");
      return antrianSeri(antrianBatch).then(function () {
        // Tambahkan delta mutasi tanpa batch
        Object.keys(deltaPerObat).forEach(function (obatId) {
          stokObat[obatId] = (stokObat[obatId] || 0) + deltaPerObat[obatId];
        });
        return stokObat;
      });
    }).then(function (stokObat) {
      tulis("Mengambil daftar obat...");
      return fetchSemua("daftar_obat", { sort: "id" }).then(function (obatList) {
        var m = 0;
        var antrianObat = obatList.map(function (ob) {
          return function () {
            var stokBaru = stokObat[ob.id] || 0;
            m++;
            if (m % 20 === 0) tulis("Obat: " + m + "/" + obatList.length + "...");
            if (Math.abs(stokBaru - (Number(ob.stok_sistem) || 0)) < 0.001) return Promise.resolve();
            return LPLPO.ubah("daftar_obat", ob.id, { stok_sistem: stokBaru });
          };
        });
        tulis("Mengupdate " + obatList.length + " obat...");
        return antrianSeri(antrianObat);
      });
    }).then(function () {
      tulis("Selesai. Stok live semua batch dan obat sudah diperbarui.");
      selesai();
    }, function (err) {
      tulis("Error: " + (err.pesan || err.message || JSON.stringify(err)));
      selesai();
    });
  }

  // Jalankan array fungsi () => Promise satu per satu
  function antrianSeri(arr) {
    return arr.reduce(function (p, fn) { return p.then(fn); }, Promise.resolve());
  }

  // Master data di halaman pengaturan (tab)
  function tabMasterPengaturan(aktif) {
    var nav = el("nav", { class: "tab tab-kecil", "aria-label": "Jenis data" });
    [["obat", "Obat"], ["unit", "Unit"], ["kategori", "Kategori"]].forEach(function (t) {
      var a = el("a", { href: "#/pengaturan/master/" + t[0] }, t[1]);
      if (t[0] === aktif) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    return nav;
  }

  function renderMasterDiArea(area, sub) {
    var bagian = { obat: daftarObat, unit: daftarUnit, kategori: daftarKategori };
    if (!bagian[sub]) sub = "obat";
    area.appendChild(tabMasterPengaturan(sub));
    var konten = el("div", {});
    area.appendChild(konten);
    bagian[sub](konten);
  }

  // ---------- Halaman yang belum dibuat ----------
  function halamanBelumAda(h) {
    return function () {
      isi.textContent = "";
      isi.appendChild(judul(h.judul, h.info));
      isi.appendChild(el("section", { class: "panel" }, [
        el("p", { style: "margin:0" }, "Halaman ini belum dibuat.")
      ]));
    };
  }

  var DAFTAR_HALAMAN = [
    { id: "dashboard",   menu: "Dashboard",       judul: "Dashboard",            render: renderDashboard },
    { id: "penerimaan",  menu: "Penerimaan",       judul: "Penerimaan obat",      render: renderPenerimaan },
    { id: "pengeluaran", menu: "Pengeluaran",      judul: "Pengeluaran obat",     render: renderPengeluaran },
    { id: "histori",     menu: "Histori mutasi",   judul: "Histori mutasi",       render: renderHistori },
    { id: "permintaan",  menu: "Permintaan",       judul: "Permintaan dari unit", info: "Periksa permintaan unit, lalu ubah menjadi pengeluaran." },
    { id: "stockopname", menu: "Stockopname",      judul: "Stockopname",          render: renderStockopname },
    { id: "stok",        menu: "Stok",             judul: "Stok",                 render: renderStok },
    { id: "laporan",     menu: "Laporan LPLPO",    judul: "Laporan LPLPO",        info: "Susun laporan bulanan dan ekspor ke Excel." },
    { id: "pengaturan",  menu: "Pengaturan",       judul: "Pengaturan",           render: renderPengaturan }
  ];

  // Routing khusus: #/pengaturan/master/obat → sub = "master/obat"
  // Sudah ditangani oleh renderPengaturan via bagian[1] "/" bagian[2]

  DAFTAR_HALAMAN.forEach(function (h) {
    if (!h.render) h.render = halamanBelumAda(h);
  });

  // ---------- Menu dan perpindahan halaman ----------
  DAFTAR_HALAMAN.forEach(function (h) {
    menu.appendChild(el("a", { href: "#/" + h.id, "data-id": h.id }, h.menu));
  });

  // Alamat #/pengaturan/master/obat dibaca sebagai halaman "pengaturan" dengan sub "master/obat".
  function halamanAktif() {
    var raw = (location.hash || "").replace(/^#\//, "");
    var bagian = raw.split("/");
    var idBagian = bagian[0].split("?")[0]; // strip query string
    if (idBagian === "kartu-stok") idBagian = "stok"; // alamat lama → menu Stok
    var h = DAFTAR_HALAMAN.filter(function (x) { return x.id === idBagian; })[0] || DAFTAR_HALAMAN[0];
    // Gabungkan sisa bagian sebagai sub (mendukung sub bertingkat seperti "master/obat")
    var sub = bagian.slice(1).join("/") || "";
    return { h: h, sub: sub };
  }

  function tampilkanHalaman() {
    var aktif = halamanAktif();
    var h = aktif.h;
    [].forEach.call(menu.querySelectorAll("a"), function (a) {
      if (a.getAttribute("data-id") === h.id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = h.judul + " | LPLPO TBU";
    h.render(aktif.sub);
    window.scrollTo(0, 0);
    var h1 = isi.querySelector("h1");
    if (h1) h1.focus();
  }

  // ---------- Sesi ----------
  function keLogin() {
    LPLPO.keluar();
    location.replace("index.html");
  }

  document.getElementById("keluar").addEventListener("click", keLogin);

  // ---------- Drawer HP ----------
  var menuNav    = document.getElementById("menu-nav");
  var overlay    = document.getElementById("drawer-overlay");
  var bukaTombol = document.getElementById("buka-drawer");
  var tutupTombol = document.getElementById("tutup-drawer");

  function bukaDrawer() {
    menuNav.classList.add("terbuka");
    overlay.classList.add("aktif");
    overlay.setAttribute("aria-hidden", "false");
    bukaTombol.setAttribute("aria-expanded", "true");
    tutupTombol.focus();
    document.body.style.overflow = "hidden";
  }

  function tutupDrawer() {
    menuNav.classList.remove("terbuka");
    overlay.classList.remove("aktif");
    overlay.setAttribute("aria-hidden", "true");
    bukaTombol.setAttribute("aria-expanded", "false");
    bukaTombol.focus();
    document.body.style.overflow = "";
  }

  bukaTombol.addEventListener("click", bukaDrawer);
  tutupTombol.addEventListener("click", tutupDrawer);
  overlay.addEventListener("click", tutupDrawer);

  // ---------- Toggle panel kiri (desktop) ----------
  var toggleNavTombol = document.getElementById("toggle-nav");
  var appEl = document.querySelector(".app");
  var KUNCI_PANEL = "lplpo_nav_tersembunyi";
  if (localStorage.getItem(KUNCI_PANEL) === "1") appEl.classList.add("nav-tersembunyi");
  if (toggleNavTombol) {
    toggleNavTombol.addEventListener("click", function () {
      var tersembunyi = appEl.classList.toggle("nav-tersembunyi");
      try { localStorage.setItem(KUNCI_PANEL, tersembunyi ? "1" : "0"); } catch(e) {}
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menuNav.classList.contains("terbuka")) tutupDrawer();
  });

  menu.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (a && menuNav.classList.contains("terbuka")) tutupDrawer();
  });

  var sesi = LPLPO.sesi();
  if (!sesi) {
    keLogin();
    return;
  }
  document.getElementById("email-admin").textContent = sesi.email || "";

  isi.appendChild(el("p", { class: "status-koneksi" }, "Menghubungkan ke server..."));
  LPLPO.segarkan().then(
    function () {
      var baru = LPLPO.sesi();
      document.getElementById("email-admin").textContent = (baru && baru.email) || "";
      window.addEventListener("hashchange", tampilkanHalaman);
      tampilkanHalaman();
    },
    function (err) {
      if (err.status === 401 || err.status === 403) return keLogin();
      isi.textContent = "";
      isi.appendChild(judul("LPLPO TBU"));
      isi.appendChild(tampilkanGalat(err, function () { location.reload(); }));
    }
  );
})();
