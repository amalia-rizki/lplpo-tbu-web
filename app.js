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
      },
      function (err) {
        if (err.status === 401 || err.status === 403) return keLogin();
        muat.replaceWith(tampilkanGalat(err, renderDashboard));
      }
    );
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

  // ---------- Autocomplete cari obat ----------
  // onPilih(obat) dipanggil saat user memilih satu item.
  // Mengembalikan elemen wrapper yang bisa langsung dimasukkan ke DOM.
  function buatCariObat(obatList, onPilih) {
    var bungkus = el("div", { class: "cari-obat-bungkus" });
    var inp = el("input", {
      type: "search", class: "cari-obat-inp",
      placeholder: "Cari nama obat...", autocomplete: "off",
      "aria-label": "Cari obat", "aria-autocomplete": "list"
    });
    var daftar = el("div", { class: "cari-obat-daftar", hidden: true, role: "listbox" });
    bungkus.appendChild(inp);
    bungkus.appendChild(daftar);

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

      // Cari di nama_utama dan nama_alias
      var cocok = obatList.filter(function (o) {
        return (o.nama_utama || "").toLowerCase().indexOf(t) !== -1 ||
               (o.nama_alias || "").toLowerCase().indexOf(t) !== -1 ||
               (o.kode || "").toLowerCase().indexOf(t) !== -1;
      }).slice(0, 30);

      if (!cocok.length) {
        daftar.appendChild(el("div", { class: "cari-obat-kosong" }, "Tidak ditemukan."));
        daftar.hidden = false;
        return;
      }

      cocok.forEach(function (o, i) {
        var item = el("div", { class: "cari-obat-item", role: "option", "data-idx": String(i) }, o.nama_utama);
        item.addEventListener("mousedown", function (e) {
          e.preventDefault(); // jaga focus tidak pindah dari inp
          inp.value = "";
          tutup();
          onPilih(o);
        });
        daftar.appendChild(item);
        itemEls.push(item);
      });
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
      } else if (e.key === "Enter" && fokusIdx >= 0) {
        e.preventDefault();
        var o2 = obatList.filter(function (o) {
          return (o.nama_utama || "").toLowerCase().indexOf(inp.value.trim().toLowerCase()) !== -1 ||
                 (o.nama_alias || "").toLowerCase().indexOf(inp.value.trim().toLowerCase()) !== -1 ||
                 (o.kode || "").toLowerCase().indexOf(inp.value.trim().toLowerCase()) !== -1;
        }).slice(0, 30)[fokusIdx];
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

    // Muat unit sumber (tipe = "sumber") dan daftar obat aktif paralel
    Promise.all([
      LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: 'tipe = "sumber" && aktif = true' }),
      LPLPO.daftar("daftar_obat", { perPage: 500, sort: "kode", expand: "kategori", filter: "aktif = true" })
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

      // State form
      var state = {
        unitId: unitList.length === 1 ? unitList[0].id : "",
        tanggal: hariIni(),
        baris: []   // { obatId, batchId (null = baru), noBatch, ed, jumlah }
      };

      // ---------- Header form: unit sumber + tanggal ----------
      var pilUnit = el("select", { class: "pnr-select", id: "pnr-unit" },
        (unitList.length > 1 ? [el("option", { value: "" }, "— Pilih sumber —")] : [])
        .concat(unitList.map(function (u) {
          return el("option", { value: u.id, selected: u.id === state.unitId ? "selected" : undefined }, u.nama);
        }))
      );
      var inpTgl = el("input", { type: "date", class: "pnr-tgl", id: "pnr-tgl", value: state.tanggal });
      pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });
      inpTgl.addEventListener("change", function () { state.tanggal = inpTgl.value; });

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
        if (!state.baris.length) {
          tabelArea.appendChild(el("p", { class: "status-koneksi" }, "Belum ada item. Tambahkan obat di bawah."));
        } else {
          state.baris.forEach(function (b, idx) {
            tabelArea.appendChild(buatBarisItem(b, idx, obatList, gambarBaris));
          });
        }
      }

      // ---------- Tambah item ----------
      var cariObat = buatCariObat(obatList, function (o) {
        var sudahAda = state.baris.some(function (b) { return b.obatId === o.id && !b._hapus; });
        if (sudahAda) return;
        state.baris.push({ obatId: o.id, batchId: null, noBatch: "", ed: "", jumlah: "" });
        gambarBaris();
        setTimeout(function () {
          var inputs = tabelArea.querySelectorAll(".pnr-inp-jumlah");
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 50);
      });

      var panelTambah = el("div", { class: "panel pnr-tambah" }, [cariObat]);
      area.appendChild(panelTambah);

      // ---------- Tombol simpan ----------
      var pesanSimpan = el("p", { class: "pesan", hidden: true });
      var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan penerimaan");
      tombolSimpan.addEventListener("click", function () {
        simpanPenerimaan(state, obatList, tombolSimpan, pesanSimpan, area);
      });
      area.appendChild(el("div", { class: "bilah-simpan" }, [pesanSimpan, tombolSimpan]));

      gambarBaris();
    }, function (err) {
      tanganiGalat(err, renderPenerimaan, area);
    });
  }

  // ---------- Autocomplete cari obat ----------
  function hariIni() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function buatBarisItem(b, idx, obatList, refresh) {
    var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
    var kartu = el("div", { class: "panel pnr-baris" });

    // Nama obat + tombol hapus
    var kepala = el("div", { class: "pnr-baris-kepala" }, [
      el("strong", {}, obat.nama_utama || b.obatId),
      el("button", { type: "button", class: "btn btn-bahaya pnr-hapus", "aria-label": "Hapus " + (obat.nama_utama || "") }, "✕")
    ]);
    kepala.querySelector(".pnr-hapus").addEventListener("click", function () {
      var i = b._idx !== undefined ? b._idx : idx;
      b._hapus = true;
      refresh();
    });
    kartu.appendChild(kepala);

    // Baris batch + jumlah
    var isiKartu = el("div", { class: "pnr-isi" });

    // Pilihan batch yang sudah ada (dimuat dari server)
    var batchArea = el("div", { class: "pnr-batch-area" });
    batchArea.appendChild(el("span", { class: "pudar pnr-label" }, "Batch:"));
    var batchScroll = el("div", { class: "pnr-batch-scroll" });
    batchArea.appendChild(batchScroll);

    // Muat batch untuk obat ini
    LPLPO.daftar("batch", {
      perPage: 50,
      sort: "-expired_date,nomor_batch",
      filter: 'obat = "' + b.obatId + '"'
    }).then(function (db) {
      batchScroll.textContent = "";
      db.items.forEach(function (bt) {
        var chip = el("button", {
          type: "button",
          class: "pnr-chip" + (b.batchId === bt.id ? " aktif" : ""),
          "data-id": bt.id
        }, [
          el("span", { class: "pnr-chip-no" }, bt.nomor_batch || "—"),
          el("span", { class: "pnr-chip-ed" }, bt.expired_date ? formatED(bt.expired_date) : "tanpa ED")
        ]);
        chip.addEventListener("click", function () {
          b.batchId = bt.id; b.noBatch = bt.nomor_batch; b.ed = bt.expired_date;
          b._batchBaru = false;
          batchScroll.querySelectorAll(".pnr-chip").forEach(function (c) { c.classList.remove("aktif"); });
          chip.classList.add("aktif");
          formBatchBaru.hidden = true;
        });
        batchScroll.appendChild(chip);
      });

      // Chip "+ Batch baru"
      var chipBaru = el("button", { type: "button", class: "pnr-chip pnr-chip-baru" }, "+ Batch baru");
      chipBaru.addEventListener("click", function () {
        b.batchId = null; b._batchBaru = true;
        batchScroll.querySelectorAll(".pnr-chip").forEach(function (c) { c.classList.remove("aktif"); });
        chipBaru.classList.add("aktif");
        formBatchBaru.hidden = false;
        inpNoBatch.focus();
      });
      batchScroll.appendChild(chipBaru);
    }, function () {
      batchScroll.appendChild(el("span", { class: "pudar" }, "Gagal memuat batch."));
    });

    // Form batch baru (tersembunyi sampai diklik)
    var inpNoBatch = el("input", { type: "text", class: "pnr-inp-batch", placeholder: "No. batch", autocomplete: "off", style: "text-transform:uppercase" });
    var inpED = el("input", { type: "month", class: "pnr-inp-ed" });
    inpNoBatch.addEventListener("input", function () { b.noBatch = inpNoBatch.value.toUpperCase(); inpNoBatch.value = inpNoBatch.value.toUpperCase(); });
    inpED.addEventListener("change", function () { b.ed = inpED.value ? inpED.value + "-01" : ""; });
    var formBatchBaru = el("div", { class: "pnr-form-batch-baru", hidden: true }, [
      el("div", { class: "field" }, [el("label", {}, "No. batch"), inpNoBatch]),
      el("div", { class: "field" }, [el("label", {}, "Expired"), inpED])
    ]);

    // Jumlah
    var inpJumlah = el("input", {
      type: "number", min: "1", step: "1", class: "pnr-inp-jumlah",
      placeholder: "Jumlah", inputmode: "numeric",
      value: b.jumlah || ""
    });
    inpJumlah.addEventListener("input", function () { b.jumlah = inpJumlah.value; });

    var satuan = el("span", { class: "pudar pnr-satuan" }, obat.satuan || "");

    isiKartu.appendChild(batchArea);
    isiKartu.appendChild(formBatchBaru);
    isiKartu.appendChild(el("div", { class: "pnr-jumlah-baris" }, [
      el("label", { class: "pudar pnr-label" }, "Jumlah:"), inpJumlah, satuan
    ]));
    kartu.appendChild(isiKartu);
    return kartu;
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
      return b.jumlah && Number(b.jumlah) > 0 && (b.batchId || b._batchBaru);
    });

    if (!valid.length) {
      pesan.textContent = "Tambahkan minimal satu item dengan jumlah dan batch.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    var tidakLengkap = state.baris.filter(function (b) {
      return !b._hapus && (!b.jumlah || Number(b.jumlah) < 1 || (!b.batchId && !b._batchBaru));
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

      // Proses satu per satu (tidak paralel, agar mudah debug)
      var antrian = valid.slice();
      var hasil = [];

      function prosesBerikutnya() {
        if (!antrian.length) {
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
            // Update stok_sistem di batch
            if (batchId) {
              return ambilBatch(batchId).then(function (bt) {
                var stokBaru = (bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : (bt.stok_awal || 0)) + delta;
                return LPLPO.ubah("batch", batchId, { stok_sistem: stokBaru });
              }).then(function () {
                hasil.push({ obat: obat, jumlah: Number(b.jumlah) });
                prosesBerikutnya();
              });
            }
            hasil.push({ obat: obat, jumlah: Number(b.jumlah) });
            prosesBerikutnya();
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
          // Buat batch baru dulu
          LPLPO.buat("batch", {
            obat: b.obatId,
            nomor_batch: b.noBatch || "",
            expired_date: b.ed || undefined,
            stok_awal: 0,
            stok_sistem: Number(b.jumlah)
          }).then(function (bt) {
            buatMutasi(bt.id);
          }, function (err) {
            pesan.textContent = "Gagal membuat batch untuk " + (obat.nama_utama || "") + ": " + (err.pesan || "");
            pesan.className = "pesan galat"; pesan.hidden = false;
            tombol.disabled = false; tombol.textContent = "Simpan penerimaan";
          });
        } else {
          buatMutasi(b.batchId);
        }
      }
      prosesBerikutnya();
    }, function (err) {
      pesan.textContent = err.pesan || "Gagal memuat data unit.";
      pesan.className = "pesan galat"; pesan.hidden = false;
      tombol.disabled = false; tombol.textContent = "Simpan penerimaan";
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

    var tombolBaru = el("button", { type: "button", class: "btn btn-utama" }, "Catat penerimaan baru");
    tombolBaru.addEventListener("click", renderPenerimaan);
    area.appendChild(el("div", { class: "bilah-simpan" }, [tombolBaru]));
  }

  // ---------- Halaman: Pengeluaran ----------
  function renderPengeluaran() {
    isi.textContent = "";
    isi.appendChild(judul("Pengeluaran obat", "Catat obat keluar ke unit."));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));

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

      var state = { unitId: "", tanggal: hariIni(), baris: [], permintaanIds: [] };

      var pilUnit = el("select", { class: "pnr-select", id: "pgl-unit" },
        [el("option", { value: "" }, "— Pilih unit tujuan —")]
        .concat(unitList.map(function (u) { return el("option", { value: u.id }, u.nama); }))
      );
      var inpTgl = el("input", { type: "date", class: "pnr-tgl", id: "pgl-tgl", value: state.tanggal });
      pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });
      inpTgl.addEventListener("change", function () { state.tanggal = inpTgl.value; });

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
            tabelArea.appendChild(buatBarisKeluarItem(b, idx, obatList, gambarBaris));
          });
        }
      }

      var cariObatPgl = buatCariObat(obatList, function (o) {
        var sudahAda = state.baris.some(function (b) { return b.obatId === o.id && !b._hapus; });
        if (sudahAda) return;
        state.baris.push({ obatId: o.id, batchId: null, jumlah: "" });
        gambarBaris();
        setTimeout(function () {
          var inputs = tabelArea.querySelectorAll(".pnr-inp-jumlah");
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 50);
      });

      area.appendChild(el("div", { class: "panel pnr-tambah" }, [cariObatPgl]));

      var pesanSimpan = el("p", { class: "pesan", hidden: true });
      var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan pengeluaran");
      tombolSimpan.addEventListener("click", function () {
        simpanPengeluaran(state, obatList, tombolSimpan, pesanSimpan, area);
      });
      area.appendChild(el("div", { class: "bilah-simpan" }, [pesanSimpan, tombolSimpan]));

      gambarBaris();
    }, function (err) {
      tanganiGalat(err, renderPengeluaran, area);
    });
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
    var inpTgl = el("input", { type: "date", class: "pnr-tgl", id: "pgl-tgl", value: state.tanggal });
    pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });
    inpTgl.addEventListener("change", function () { state.tanggal = inpTgl.value; });

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
          tabelArea.appendChild(buatBarisKeluarItem(b, idx, obatList, gambarBaris));
        });
      }
    }

    var cariObatDp = buatCariObat(obatList, function (o) {
      var sudahAda = state.baris.some(function (b) { return b.obatId === o.id && !b._hapus; });
      if (sudahAda) return;
      state.baris.push({ obatId: o.id, batchId: null, jumlah: "" });
      gambarBaris();
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

  function buatBarisKeluarItem(b, idx, obatList, refresh) {
    var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
    var kartu = el("div", { class: "panel pnr-baris" });

    var info = el("span", { class: "pudar", style: "font-size:14px" },
      b.permintaanId ? " (dari permintaan)" : "");
    var kepala = el("div", { class: "pnr-baris-kepala" }, [
      el("div", {}, [el("strong", {}, obat.nama_utama || b.obatId), info]),
      el("button", { type: "button", class: "btn btn-bahaya pnr-hapus", "aria-label": "Hapus" }, "✕")
    ]);
    kepala.querySelector(".pnr-hapus").addEventListener("click", function () {
      b._hapus = true; refresh();
    });
    kartu.appendChild(kepala);

    var isiKartu = el("div", { class: "pnr-isi" });

    var batchArea = el("div", { class: "pnr-batch-area" });
    batchArea.appendChild(el("span", { class: "pudar pnr-label" }, "Batch (pilih FEFO):"));
    var batchScroll = el("div", { class: "pnr-batch-scroll" });
    batchArea.appendChild(batchScroll);

    LPLPO.daftar("batch", {
      perPage: 50,
      sort: "expired_date,nomor_batch",
      filter: 'obat = "' + b.obatId + '" && stok_sistem > 0'
    }).then(function (db) {
      batchScroll.textContent = "";
      if (!db.items.length) {
        batchScroll.appendChild(el("span", { class: "pudar" }, "Tidak ada stok tersedia."));
        return;
      }
      db.items.forEach(function (bt, i) {
        var chip = el("button", {
          type: "button",
          class: "pnr-chip" + (i === 0 ? " aktif" : ""),
          "data-id": bt.id
        }, [
          el("span", { class: "pnr-chip-no" }, bt.nomor_batch || "—"),
          el("span", { class: "pnr-chip-ed" }, (bt.expired_date ? formatED(bt.expired_date) : "tanpa ED") + " \xb7 stok " + (bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : 0))
        ]);
        if (i === 0) { b.batchId = bt.id; }
        chip.addEventListener("click", function () {
          b.batchId = bt.id;
          batchScroll.querySelectorAll(".pnr-chip").forEach(function (c) { c.classList.remove("aktif"); });
          chip.classList.add("aktif");
        });
        batchScroll.appendChild(chip);
      });
    }, function () {
      batchScroll.appendChild(el("span", { class: "pudar" }, "Gagal memuat batch."));
    });

    var inpJumlah = el("input", {
      type: "number", min: "1", step: "1", class: "pnr-inp-jumlah",
      placeholder: "Jumlah", inputmode: "numeric",
      value: b.jumlah || ""
    });
    inpJumlah.addEventListener("input", function () { b.jumlah = inpJumlah.value; });

    isiKartu.appendChild(batchArea);
    isiKartu.appendChild(el("div", { class: "pnr-jumlah-baris" }, [
      el("label", { class: "pudar pnr-label" }, "Jumlah:"),
      inpJumlah,
      el("span", { class: "pudar pnr-satuan" }, obat.satuan || "")
    ]));
    kartu.appendChild(isiKartu);
    return kartu;
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
      return !b.jumlah || Number(b.jumlah) < 1 || !b.batchId;
    });
    if (tidakLengkap.length) {
      pesan.textContent = tidakLengkap.length + " item belum lengkap (jumlah atau batch belum dipilih).";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    tombol.disabled = true; tombol.textContent = "Menyimpan...";
    pesan.hidden = true;

    var antrian = state.baris.slice();
    var hasilList = [];

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
          LPLPO.ubah("permintaan_unit", b.permintaanId, {
            status: "selesai",
            jumlah_beri: Number(b.jumlah)
          }).then(updateBerikutnya, updateBerikutnya);
        }
        updateBerikutnya();
        return;
      }
      var b = antrian.shift();
      var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
      LPLPO.buat("mutasi", {
        obat: b.obatId,
        batch: b.batchId,
        unit: state.unitId,
        jenis: "keluar",
        jumlah: Number(b.jumlah),
        tanggal: state.tanggal,
        status: "confirmed",
        catatan: ""
      }).then(function () {
        // Update stok_sistem di batch
        if (b.batchId) {
          var ambilBatchKeluar = typeof LPLPO.ambil === "function"
            ? function (id) { return LPLPO.ambil("batch", id); }
            : function (id) {
                var s = LPLPO.sesi() || {};
                return fetch(window.LPLPO_CONFIG.API + "/api/collections/batch/records/" + id, {
                  headers: { Authorization: s.token || "" }
                }).then(function (r) { return r.json(); });
              };
          return ambilBatchKeluar(b.batchId).then(function (bt) {
            var stokBaru = (bt.stok_sistem !== undefined && bt.stok_sistem !== null ? bt.stok_sistem : (bt.stok_awal || 0)) - Number(b.jumlah);
            return LPLPO.ubah("batch", b.batchId, { stok_sistem: stokBaru });
          }).then(function () {
            hasilList.push({ obat: obat, jumlah: Number(b.jumlah) });
            prosesBerikutnya();
          });
        }
        hasilList.push({ obat: obat, jumlah: Number(b.jumlah) });
        prosesBerikutnya();
      }, function (err) {
        pesan.textContent = "Gagal menyimpan " + (obat.nama_utama || "") + ": " + (err.pesan || "");
        pesan.className = "pesan galat"; pesan.hidden = false;
        tombol.disabled = false; tombol.textContent = "Simpan pengeluaran";
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
    var tombolBaru = el("button", { type: "button", class: "btn btn-utama" }, "Catat pengeluaran baru");
    tombolBaru.addEventListener("click", renderPengeluaran);
    area.appendChild(el("div", { class: "bilah-simpan" }, [tombolCetak, tombolBaru]));
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
      batch: batchId,
      obat: obatId,
      stok_fisik: stokFisik
    };
    if (itemId) {
      return LPLPO.ubah("stockopname_item", itemId, { stok_fisik: stokFisik });
    }
    return LPLPO.buat("stockopname_item", data);
  }

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
      var inpTgl = el("input", { type: "date", class: "so-inp-edit", value: tglDefault, "aria-label": "Tanggal stockopname" });
      var inpCatatan = el("input", { type: "text", class: "so-inp-edit", placeholder: "Catatan (opsional)", "aria-label": "Catatan" });
      var tombolBuat = el("button", { type: "button", class: "btn btn-utama" }, "+ Buat SO baru");
      var pesanBuat = el("p", { class: "pesan", hidden: true });

      tombolBuat.addEventListener("click", function () {
        if (!inpTgl.value) {
          pesanBuat.textContent = "Pilih tanggal SO.";
          pesanBuat.className = "pesan galat"; pesanBuat.hidden = false; return;
        }
        tombolBuat.disabled = true; tombolBuat.textContent = "Membuat...";
        LPLPO.buat("stockopname", {
          tanggal: inpTgl.value,
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
    area.appendChild(tombolGanti);

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

      var lblStatus = el("span", { class: "so-status-label pudar" },
        "Periode: " + formatBulanSO(so.tanggal) + " · Status: " + (so.status || "draft"));
      kontenTab.appendChild(lblStatus);

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

  function tahapHitung(area, soId, lblStatus) {
    area.textContent = "";
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data batch..."));

    // Muat batch dan item SO yang sudah tersimpan secara paralel
    Promise.all([
      daftarSemua("batch", { perPage: 200, sort: "nomor_batch", expand: "obat" }),
      ambilItemSO(soId)
    ]).then(function (hasil) {
      var d = hasil[0];
      var soItems = hasil[1];

      if (!d.items.length) {
        area.textContent = "";
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Belum ada data batch. Seed data batch terlebih dahulu.")
        ]));
        return;
      }

      // Buat index: batchId → stockopname_item
      var itemIndex = {};
      soItems.items.forEach(function (si) {
        itemIndex[si.batch] = si;
      });

      d.items.forEach(function (b) {
        b._stok_sistem = (b.stok_sistem !== null && b.stok_sistem !== undefined)
          ? b.stok_sistem
          : (b.stok_awal || 0);
      });

      area.textContent = "";

      var items = d.items.filter(function (b) { return !edLewat(b.expired_date); });

      var URUT_KAT = ["A","T","B","F","D","C","E","G","H","I","J","K","L","M","V","W","N","O","P","Q","R","S","X","U","Y"];
      function urutObat(kode) {
        if (!kode) return [99, "", ""];
        var bagian = kode.split("-");
        var kat = bagian[0] || "";
        var idx = URUT_KAT.indexOf(kat);
        return [idx === -1 ? 98 : idx, kat, kode];
      }
      items.sort(function (a, b) {
        var oa = (a.expand && (a.expand.obat || a.expand.daftar_obat)) || {};
        var ob = (b.expand && (b.expand.obat || b.expand.daftar_obat)) || {};
        var ua = urutObat(oa.kode), ub = urutObat(ob.kode);
        if (ua[0] !== ub[0]) return ua[0] - ub[0];
        if (ua[2] < ub[2]) return -1;
        if (ua[2] > ub[2]) return 1;
        return (a.nomor_batch || "").localeCompare(b.nomor_batch || "");
      });

      if (!items.length) {
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Semua batch sudah melewati tanggal kedaluwarsa.")
        ]));
        return;
      }

      var tersembunyi = d.items.length - items.length;
      if (tersembunyi > 0) {
        area.appendChild(el("p", { class: "status-koneksi" },
          tersembunyi + " batch dengan ED yang sudah lewat tidak ditampilkan; di tab Penyesuaian dianggap fisik 0."));
      }

      // Map: batchId → {input, itemId, obatId}
      var inputMap = {};

      var kepala = el("thead", {}, [el("tr", {}, [
        el("th", {}, "Nama obat"),
        el("th", {}, "No. batch"),
        el("th", {}, "ED"),
        el("th", { class: "n" }, "Stok sistem"),
        el("th", { class: "n" }, "Jumlah fisik")
      ])]);

      var badan = el("tbody");
      items.forEach(function (b) {
        var obat = (b.expand && (b.expand.obat || b.expand.daftar_obat)) || {};
        var siItem = itemIndex[b.id];
        var nilaiSimpan = siItem ? siItem.stok_fisik : "";

        var indikator = el("span", { class: "so-ind", title: "belum disimpan", "aria-hidden": "true" }, "");
        if (siItem) {
          indikator.className = "so-ind so-ind-ok";
          indikator.title = "tersimpan";
        }

        var inp = el("input", {
          type: "number", min: "0", step: "1",
          class: "inp-fisik", "data-id": b.id,
          value: nilaiSimpan !== "" && nilaiSimpan !== null && nilaiSimpan !== undefined ? String(nilaiSimpan) : "",
          inputmode: "numeric",
          "aria-label": "Jumlah fisik " + (obat.nama_utama || b.id)
        });

        // Referensi itemId bisa berubah saat create
        var state = { itemId: siItem ? siItem.id : null, saving: false };
        inputMap[b.id] = { inp: inp, state: state };

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
            // Update hitungan
            var diisi = items.filter(function (x) { return inputMap[x.id] && inputMap[x.id].inp.value !== ""; }).length;
            infoIsi.textContent = diisi + " dari " + items.length + " batch sudah diisi.";
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

        var edBulanIni = false;
        if (b.expired_date) {
          var d2 = new Date(b.expired_date);
          var skrg = new Date();
          edBulanIni = d2.getFullYear() === skrg.getFullYear() && d2.getMonth() === skrg.getMonth();
        }
        // Sel batch: teks normal + tombol edit kecil; saat edit → input teks + input ED
        var spanBatchTeks = el("span", {}, b.nomor_batch || "-");
        var spanEDTeks    = el("span", {}, formatED(b.expired_date));
        var tombolEBatch  = el("button", { type: "button", class: "so-btn-edit-inline", title: "Edit no. batch & ED", "aria-label": "Edit" }, "✏");
        var inpBatchEdit  = el("input", { type: "text", class: "so-inp-tabel so-inp-batch-edit", value: b.nomor_batch || "", placeholder: "No. batch", hidden: true, style: "text-transform:uppercase" });
        var edValEdit     = b.expired_date ? b.expired_date.slice(0, 7) : "";
        var inpEDEdit     = el("input", { type: "month", class: "so-inp-tabel", value: edValEdit, hidden: true });
        var tombolSimpEB  = el("button", { type: "button", class: "btn btn-garis so-btn-simpan-ed", hidden: true }, "✓");
        var tombolBatalEB = el("button", { type: "button", class: "so-btn-edit-inline", hidden: true, title: "Batal" }, "✕");
        var indEB         = el("span", { class: "so-ind", "aria-hidden": "true" }, "");

        inpBatchEdit.addEventListener("input", function () { inpBatchEdit.value = inpBatchEdit.value.toUpperCase(); });

        function bukaEditB() {
          spanBatchTeks.hidden = true; spanEDTeks.hidden = true; tombolEBatch.hidden = true;
          inpBatchEdit.hidden = false; inpEDEdit.hidden = false;
          tombolSimpEB.hidden = false; tombolBatalEB.hidden = false;
          inpBatchEdit.focus();
        }
        function tutupEditB() {
          spanBatchTeks.hidden = false; spanEDTeks.hidden = false; tombolEBatch.hidden = false;
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
            spanBatchTeks.textContent = noBaru || "-";
            spanEDTeks.textContent = formatED(edBaru);
            indEB.className = "so-ind so-ind-ok";
            tutupEditB();
          }, function () { indEB.className = "so-ind so-ind-err"; });
        });

        var tdBatchHitung = el("td", { "data-label": "No. batch" }, [
          spanBatchTeks, tombolEBatch, inpBatchEdit, indEB
        ]);
        var tdEDHitung = el("td", { "data-label": "ED" }, [
          spanEDTeks, inpEDEdit, tombolSimpEB, tombolBatalEB
        ]);

        var tr = el("tr", { class: edBulanIni ? "terpilih" : "" }, [
          el("td", { class: "utama", "data-label": "" }, obat.nama_utama || "-"),
          tdBatchHitung,
          tdEDHitung,
          el("td", { class: "n", "data-label": "Stok sistem" },
            b._stok_sistem !== undefined ? String(b._stok_sistem) : "-"),
          el("td", { class: "n so-td-fisik", "data-label": "Jumlah fisik" }, [inp, indikator])
        ]);
        badan.appendChild(tr);
      });

      var tabel = el("table", { class: "kartu" }, [kepala, badan]);
      area.appendChild(el("div", { class: "daftar" }, [el("div", { class: "tabel-gulir" }, [tabel])]));

      var sudahDiisi = items.filter(function (b) {
        return itemIndex[b.id] !== undefined;
      }).length;
      var infoIsi = el("p", { class: "status-koneksi" },
        sudahDiisi + " dari " + items.length + " batch sudah diisi.");
      area.appendChild(infoIsi);

      var tombolLanjut = el("button", { type: "button", class: "btn btn-utama" }, "Lihat selisih →");
      tombolLanjut.addEventListener("click", function () {
        location.hash = "#/stockopname/sesuaikan";
      });

      var tombolTambahBatch = el("button", { type: "button", class: "btn btn-garis" }, "+ Batch Baru");
      tombolTambahBatch.addEventListener("click", function () {
        bukaTambahBatch(area, soId, function () { tahapHitung(area, soId, lblStatus); });
      });

      area.appendChild(el("div", { class: "bilah-simpan" }, [tombolTambahBatch, tombolLanjut]));

    }, function (err) {
      tanganiGalat(err, function () { tahapHitung(area, soId, lblStatus); }, area);
    });
  }

  function bukaTambahBatch(areaSO, soId, onSelesai) {
    var overlay = el("div", { class: "modal-overlay" });
    var kotak = el("div", { class: "modal-kotak panel modal-kotak-scroll" });
    overlay.appendChild(kotak);
    document.body.appendChild(overlay);

    function tutup() { document.body.removeChild(overlay); }
    overlay.addEventListener("click", function (e) { if (e.target === overlay) tutup(); });

    kotak.appendChild(el("h3", { style: "margin-top:0" }, "Tambah Batch Baru"));
    kotak.appendChild(el("p", { class: "status-koneksi" }, "Memuat daftar obat..."));

    LPLPO.daftar("daftar_obat", { perPage: 500, sort: "kode", filter: "aktif=true && pakai_batch=true", expand: "kategori" })
      .then(function (dObat) {
        kotak.textContent = "";
        kotak.appendChild(el("h3", { style: "margin-top:0" }, "Tambah Batch Baru"));

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
            stok_awal: Number(jumlah),
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

  // tahapSesuaikan: daftar per-item (satu baris = satu obat)
  function tahapSesuaikan(area, soId) {
    area.textContent = "";
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data untuk penyesuaian..."));

    Promise.all([
      daftarSemua("batch", { perPage: 500, sort: "nomor_batch", expand: "obat,daftar_obat" }),
      ambilItemSO(soId)
    ]).then(function (hasil) {
      var semuaBatch = hasil[0].items;
      var soItems = hasil[1].items;

      var itemIndex = {};
      soItems.forEach(function (si) { itemIndex[si.batch] = si; });

      if (!soItems.length) {
        area.textContent = "";
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Belum ada data penghitungan. Isi jumlah fisik di tab Penghitungan terlebih dahulu.")
        ]));
        return;
      }

      semuaBatch.forEach(function (b) {
        b._stok_sistem = (b.stok_sistem !== null && b.stok_sistem !== undefined) ? b.stok_sistem : (b.stok_awal || 0);
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
        if (!obatMap[obatId]) obatMap[obatId] = { obat: obat, obatId: obatId, batch: [], totalSistem: 0, totalFisik: 0, adaNull: false };
        var fisik = fisikDari(b);
        obatMap[obatId].batch.push(b);
        obatMap[obatId].totalSistem += b._stok_sistem;
        if (fisik === null) { obatMap[obatId].adaNull = true; }
        else { obatMap[obatId].totalFisik += fisik; }
      });

      var URUT_KAT = ["A","T","B","F","D","C","E","G","H","I","J","K","L","M","V","W","N","O","P","Q","R","S","X","U","Y"];
      function urutObat(kode) {
        if (!kode) return [99, "", ""];
        var bagian = kode.split("-");
        var idx = URUT_KAT.indexOf(bagian[0] || "");
        return [idx === -1 ? 98 : idx, kode];
      }

      // Filter hanya yang ada selisih (dan tidak semua batch null = belum dihitung)
      var daftarItem = Object.keys(obatMap).map(function (id) { return obatMap[id]; })
        .filter(function (item) {
          if (item.adaNull && item.batch.every(function (b) { return fisikDari(b) === null; })) return false;
          return item.totalFisik !== item.totalSistem;
        })
        .sort(function (a, b) {
          var ua = urutObat(a.obat.kode), ub = urutObat(b.obat.kode);
          if (ua[0] !== ub[0]) return ua[0] - ub[0];
          return (ua[1] || "").localeCompare(ub[1] || "");
        });

      area.textContent = "";

      if (soPesanTerakhir) {
        area.appendChild(el("p", { class: "pesan info" }, soPesanTerakhir));
        soPesanTerakhir = "";
      }

      if (!daftarItem.length) {
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Tidak ada selisih. Semua stok cocok dengan hitungan fisik. 🎉")
        ]));
        return;
      }

      area.appendChild(el("p", {}, daftarItem.length + " obat memiliki selisih:"));

      daftarItem.forEach(function (item) {
        var diff = item.totalFisik - item.totalSistem;
        var diffStr = (diff > 0 ? "+" : "") + diff;
        var diffKelas = diff > 0 ? "lebih" : "kurang";
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
          var label = (b.nomor_batch || "tanpa batch") + (b.expired_date ? " (" + formatED(b.expired_date) + ")" : "");
          return el("span", { class: "so-batch-chip " + (d > 0 ? "lebih" : "kurang") }, label + " " + dStr);
        });

        var kartu = el("a", {
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
          el("div", { class: "so-kartu-lihat pudar" }, "Lihat detail →")
        ]);
        area.appendChild(kartu);
      });

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
      return akhir.getFullYear() + "-" + String(akhir.getMonth() + 1).padStart(2, "0") + "-" + String(akhir.getDate()).padStart(2, "0");
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

      var itemIndex = {};
      soItems.forEach(function (si) { itemIndex[si.batch] = si; });

      function fisikDari(b) {
        var si = itemIndex[b.id];
        if (si) return Number(si.stok_fisik);
        if (edLewat(b.expired_date)) return 0;
        return null;
      }

      batchObat.forEach(function (b) {
        b._stok_sistem = (b.stok_sistem !== null && b.stok_sistem !== undefined) ? b.stok_sistem : (b.stok_awal || 0);
      });

      area.textContent = "";

      // Tombol kembali
      var tombolKembali = el("a", { href: "#/stockopname/sesuaikan", class: "btn btn-garis so-btn-kembali" }, "← Kembali");
      area.appendChild(tombolKembali);

      // Hitung selisih total (sistem vs fisik) untuk header
      var totalSistem = batchObat.reduce(function (acc, bt) { return acc + bt._stok_sistem; }, 0);
      var totalFisikHeader = batchObat.reduce(function (acc, bt) {
        var f = fisikDari(bt); return f !== null ? acc + f : acc;
      }, 0);
      var adaFisik = batchObat.some(function (bt) { return fisikDari(bt) !== null; });
      var diffTotal = totalFisikHeader - totalSistem;
      var diffTotalStr = (diffTotal > 0 ? "+" : "") + diffTotal;
      var satuan = obat.satuan || "";

      var selisihTotalEl = adaFisik
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
          el("span", {}, "Cutoff: " + cutoff)
        ])
      ]);
      area.appendChild(headerItem);

      // --- Bagian 1: Ringkasan per batch ---
      var batchSelisih = batchObat.filter(function (b) {
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
              el("span", { class: "so-batch-no" }, b.nomor_batch || "tanpa batch"),
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
      var tombolRecalc = el("button", { type: "button", class: "btn btn-hijau", style: "font-size:13px" }, "⟳ Recalc stok sistem");
      tombolRecalc.addEventListener("click", function () {
        tombolRecalc.disabled = true;
        indRecalc.className = "so-ind so-ind-loading";

        var sisaBatch = {};
        batchObat.forEach(function (bt) { sisaBatch[bt.id] = Number(bt.stok_awal) || 0; });
        // semuaTx sudah difilter sampai cutoff saat fetch
        semuaTx.forEach(function (tx) {
          if (!tx.batch) return;
          var j = Number(tx.jumlah) || 0;
          if (!(tx.batch in sisaBatch)) sisaBatch[tx.batch] = 0;
          if (tx.jenis === "masuk") sisaBatch[tx.batch] += j;
          else sisaBatch[tx.batch] -= j;
        });

        var patches = batchObat.map(function (bt) {
          return LPLPO.ubah("batch", bt.id, { stok_sistem: sisaBatch[bt.id] || 0 }).then(function () {
            bt._stok_sistem = sisaBatch[bt.id] || 0;
            bt.stok_sistem = bt._stok_sistem;
          });
        });
        Promise.all(patches).then(function () {
          indRecalc.className = "so-ind so-ind-ok";
          tombolRecalc.disabled = false;
          renderDetailItem(area, soId, obatId);
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
        return [el("option", { value: "" }, "— tanpa relasi batch —")].concat(
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
          var bid = tx.batch || null;
          if (tx.jenis === "masuk") {
            sisaTotal += j;
            if (bid) runBatch[bid] = (runBatch[bid] || 0) + j;
          } else {
            sisaTotal -= j;
            if (bid) runBatch[bid] = (runBatch[bid] || 0) - j;
          }
          return { total: sisaTotal, batch: bid !== null ? runBatch[bid] : null };
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
          el("th", { class: "n" }, "Sisa batch"),
          el("th", { class: "n" }, "Sisa total"),
          el("th", {}, "")
        ])]);
        var tbody = el("tbody", {});

        // Baris saldo awal per batch
        batchObat.forEach(function (bt, bi) {
          var stokAwalBt = Number(bt.stok_awal) || 0;
          var labelBt = (bt.nomor_batch || "tanpa batch") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : "");
          // Sisa total kumulatif di baris saldo awal = jumlah stok_awal s.d. batch ini
          var sisaTotalAwal = batchObat.slice(0, bi + 1).reduce(function (acc, x) { return acc + (Number(x.stok_awal) || 0); }, 0);
          tbody.appendChild(el("tr", { class: "so-tx-tr-awal" }, [
            el("td", { "data-label": "Tanggal", class: "pudar" }, bi === 0 ? "Saldo awal" : ""),
            el("td", { "data-label": "Dari / Ke" }, ""),
            el("td", { "data-label": "Batch", class: "pudar" }, labelBt),
            el("td", { "data-label": "Masuk", class: "n" }, formatAngka(stokAwalBt)),
            el("td", { "data-label": "Keluar", class: "n" }, ""),
            el("td", { "data-label": "Sisa batch", class: "n" }, formatAngka(stokAwalBt)),
            el("td", { "data-label": "Sisa total", class: "n" }, formatAngka(sisaTotalAwal)),
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
          var spanTgl = el("span", {}, tx.tanggal ? tx.tanggal.slice(0, 10) : "—");
          var inpTgl = el("input", { type: "date", class: "so-inp-tabel", value: tx.tanggal ? tx.tanggal.slice(0, 10) : "", hidden: true });
          var indTgl = el("span", { class: "so-ind", "aria-hidden": "true" });
          tdTgl.appendChild(spanTgl); tdTgl.appendChild(inpTgl); tdTgl.appendChild(indTgl);
          spanTgl.addEventListener("click", function () { spanTgl.hidden = true; inpTgl.hidden = false; inpTgl.focus(); });
          inpTgl.addEventListener("blur", function () {
            if (!inpTgl.value || inpTgl.value === (tx.tanggal ? tx.tanggal.slice(0, 10) : "")) { spanTgl.hidden = false; inpTgl.hidden = true; return; }
            indTgl.className = "so-ind so-ind-loading";
            LPLPO.ubah("mutasi", tx.id, { tanggal: inpTgl.value }).then(function () {
              tx.tanggal = inpTgl.value; spanTgl.textContent = inpTgl.value;
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
              spanBatch.textContent = bt ? (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : "") : "tanpa batch";
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

          // Tombol Pisah (hanya untuk baris yang punya batch)
          if (tx.batch) {
            var tombolPisah = el("button", { type: "button", class: "btn btn-garis so-btn-pisah-tx", title: "Pisahkan ke dua batch", "aria-label": "Pisah" }, "⇥");
            tombolPisah.addEventListener("click", function () {
              bukaPopupPisahBatch(tx, jumlah, batchObat, function () {
                // reload
                renderDetailItem(area, soId, obatId);
              });
            });
            tdHapus.appendChild(tombolPisah);
          }

          var tombolH = el("button", { type: "button", class: "btn btn-bahaya so-btn-hapus-tx", title: "Hapus", "aria-label": "Hapus" }, "✕");
          tombolH.addEventListener("click", function () {
            var label = (tx.tanggal ? tx.tanggal.slice(0, 10) : "") + " · " + (tx.jenis === "masuk" ? "Masuk" : "Keluar") + " " + jumlah + " · " + unitNama;
            if (!window.confirm("Hapus mutasi ini?\n" + label + "\n\nTidak bisa dibatalkan.")) return;
            tombolH.disabled = true;
            hapusRecord("mutasi", tx.id).then(function () {
              semuaTx.splice(semuaTx.indexOf(tx), 1);
              gambarTabel();
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
    var inpTambahTanggal = el("input", { type: "date", class: "so-inp-edit", value: tglHari, "aria-label": "Tanggal mutasi" });
    var pilBatchTambah = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch" },
      [el("option", { value: "" }, "— tanpa relasi batch —")].concat(batchObat.map(function (bt) {
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
      var tanggal = inpTambahTanggal.value || tglHari;
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

    var labelBatchAsal = batchObat.reduce(function (acc, bt) {
      return bt.id === tx.batch ? (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : "") : acc;
    }, "?");

    kotak.appendChild(el("p", { style: "margin:0 0 12px; font-size:13px" },
      "Mutasi " + (tx.jenis === "masuk" ? "masuk" : "keluar") + " " + jumlahAsal + " dari batch " + labelBatchAsal + " akan dipecah menjadi dua baris dengan batch berbeda."));

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

    var pilBatch1 = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch untuk bagian 1" },
      batchObat.map(function (bt) {
        return el("option", { value: bt.id, selected: bt.id === tx.batch }, (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : ""));
      }));
    var pilBatch2 = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch untuk bagian 2" },
      [el("option", { value: "" }, "— Pilih batch —")].concat(batchObat.filter(function (bt) { return bt.id !== tx.batch; }).map(function (bt) {
        return el("option", { value: bt.id }, (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : ""));
      })));

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

      // Patch mutasi asli: ganti jumlah ke j1 dan batch ke b1
      LPLPO.ubah("mutasi", tx.id, { jumlah: j1, batch: b1 }).then(function () {
        // Buat mutasi baru untuk j2 dengan batch b2
        return LPLPO.buat("mutasi", {
          obat: tx.obat,
          batch: b2,
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
      [el("option", { value: "" }, "— tanpa relasi batch —")].concat(batchObat.map(function (bt) {
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
      var tanggal = inpTambahTanggal.value || tglHari;
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



  function renderKartuStok() {
    isi.textContent = "";
    isi.appendChild(judul("Kartu stok", "Riwayat mutasi dan saldo berjalan per obat."));

    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);

    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat daftar obat..."));

    LPLPO.daftar("daftar_obat", {
      perPage: 500, sort: "kode",
      filter: "aktif = true"
    }).then(function (d) {
      area.textContent = "";

      var obatList = d.items;

      var labelSatuan = el("span", { class: "status-koneksi ks-satuan-label" }, "");

      var cariEl = buatCariObat(obatList, function (obat) {
        labelSatuan.textContent = obat.satuan ? "Satuan: " + obat.satuan : "";
        muatKartuStok(obat, areaHasil);
      });

      area.appendChild(el("div", { class: "ks-cari-baris" }, [cariEl, labelSatuan]));

      var areaHasil = el("div", { class: "batas-dalam" }, [
        el("p", { class: "status-koneksi" }, "Pilih obat untuk melihat kartu stok.")
      ]);
      area.appendChild(areaHasil);

    }, function (err) {
      tanganiGalat(err, renderKartuStok, area);
    });
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
      var items = hasil[0].items;
      var batchList = hasil[1].items;

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
          nomor_batch:  batch ? (batch.nomor_batch || "—") : (m.batch ? "?" : "—"),
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

      var batchRincian;
      if (batchAktif.length) {
        var batchRows = batchAktif.map(function (bt) {
          var stok = bt.stok_sistem !== null && bt.stok_sistem !== undefined ? bt.stok_sistem : (bt.stok_awal || 0);
          return el("div", { class: "ks-batch-baris" }, [
            el("span", { class: "ks-batch-no" }, bt.nomor_batch || "—"),
            el("span", { class: "pudar ks-batch-ed" }, bt.expired_date ? formatED(bt.expired_date) : "tanpa ED"),
            el("span", { class: "ks-batch-stok" + (stok < 0 ? " ks-negatif" : "") }, formatAngka(stok))
          ]);
        });
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
            el("span", { class: "pudar" }, obat.kode ? " · " + obat.kode : "")
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
            el("td", { "data-label": "Tanggal" }, b.tanggal ? b.tanggal.slice(0, 10) : "—"),
            el("td", { "data-label": "Dokumen" }, ""),
            el("td", { "data-label": "Dari / Ke" }, b.unit_nama),
            el("td", { "data-label": "Batch", class: "pudar" }, b.nomor_batch),
            el("td", { "data-label": "Kadaluwarsa", class: "pudar" }, b.expired_date ? formatED(b.expired_date) : "—"),
            el("td", { "data-label": "Masuk", class: "n ks-masuk" }, b.masuk != null ? formatAngka(b.masuk) : ""),
            el("td", { "data-label": "Keluar", class: "n ks-keluar" }, b.keluar != null ? formatAngka(b.keluar) : ""),
            el("td", { "data-label": "Sisa Stok", class: "n" + (b.sisa < 0 ? " ks-negatif" : "") },
              formatAngka(b.sisa))
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

      areaHasil.append(infoRingkas, filterBar, tabel);

    }, function (err) {
      tanganiGalat(err, function () { muatKartuStok(obat, areaHasil); }, areaHasil);
    });
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
    { id: "dashboard",   menu: "Dashboard",      judul: "Dashboard",           render: renderDashboard },
    { id: "penerimaan",  menu: "Penerimaan",      judul: "Penerimaan obat",     render: renderPenerimaan },
    { id: "pengeluaran", menu: "Pengeluaran",     judul: "Pengeluaran obat",    render: renderPengeluaran },
    { id: "permintaan",  menu: "Permintaan",      judul: "Permintaan dari unit", info: "Periksa permintaan unit, lalu ubah menjadi pengeluaran." },
    { id: "stockopname", menu: "Stockopname",     judul: "Stockopname",         render: renderStockopname },
    { id: "kartu-stok",  menu: "Kartu stok",      judul: "Kartu stok",          render: renderKartuStok },
    { id: "stok",        menu: "Stok dan batch",  judul: "Stok dan batch",      info: "Stok per batch dengan penanda ED." },
    { id: "laporan",     menu: "Laporan LPLPO",   judul: "Laporan LPLPO",       info: "Susun laporan bulanan dan ekspor ke Excel." },
    { id: "master",      menu: "Master data",     judul: "Master data",         render: renderMaster },
    { id: "pengaturan",  menu: "Pengaturan",      judul: "Pengaturan",          info: "Preferensi tampilan, profil, dan konfigurasi aplikasi." }
  ];

  DAFTAR_HALAMAN.forEach(function (h) {
    if (!h.render) h.render = halamanBelumAda(h);
  });

  // ---------- Menu dan perpindahan halaman ----------
  DAFTAR_HALAMAN.forEach(function (h) {
    menu.appendChild(el("a", { href: "#/" + h.id, "data-id": h.id }, h.menu));
  });

  // Alamat #/master/unit dibaca sebagai halaman "master" dengan bagian "unit".
  function halamanAktif() {
    var bagian = (location.hash || "").replace(/^#\//, "").split("/");
    var h = DAFTAR_HALAMAN.filter(function (x) { return x.id === bagian[0]; })[0] || DAFTAR_HALAMAN[0];
    return { h: h, sub: bagian[1] || "" };
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
