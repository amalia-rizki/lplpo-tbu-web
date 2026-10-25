// Penghubung ke PocketBase v0.22 (tanpa library, hanya fetch).
// Dipakai oleh index.html (login) dan app.html (aplikasi).
(function () {
  var cfg = window.LPLPO_CONFIG;
  var KUNCI = "lplpo_sesi";

  function bacaSesi() {
    try {
      var s = JSON.parse(localStorage.getItem(KUNCI) || "null");
      return s && s.token ? s : null;
    } catch (e) {
      return null;
    }
  }

  function simpanSesi(token, admin) {
    try {
      localStorage.setItem(KUNCI, JSON.stringify({ token: token, email: admin && admin.email }));
    } catch (e) {}
  }

  function hapusSesi() {
    try {
      localStorage.removeItem(KUNCI);
    } catch (e) {}
  }

  // Kirim permintaan ke PocketBase. Mengembalikan Promise berisi JSON.
  // Galat: objek Error dengan .status (0 = tidak tersambung) dan .pesan (bahasa Indonesia).
  function minta(metode, jalur, badan) {
    var kontrol = new AbortController();
    var timer = setTimeout(function () { kontrol.abort(); }, cfg.BATAS_WAKTU || 30000);
    var header = { "Content-Type": "application/json" };
    var sesi = bacaSesi();
    if (sesi) header["Authorization"] = sesi.token;

    return fetch(cfg.API + jalur, {
      method: metode,
      headers: header,
      body: badan ? JSON.stringify(badan) : undefined,
      signal: kontrol.signal
    })
      .then(function (res) {
        clearTimeout(timer);
        return res.text().then(function (teks) {
          var data = null;
          try { data = teks ? JSON.parse(teks) : null; } catch (e) {}
          if (!res.ok) {
            var err = new Error((data && data.message) || "Permintaan gagal");
            err.status = res.status;
            err.pesan = pesanGalat(res.status);
            throw err;
          }
          return data;
        });
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (err && err.status !== undefined) throw err;
        var gagal = new Error("Tidak tersambung");
        gagal.status = 0;
        gagal.pesan = "Tidak bisa terhubung ke server. Periksa internet, lalu coba lagi.";
        throw gagal;
      });
  }

  function pesanGalat(status) {
    if (status === 400) return "Data tidak valid. Periksa isian lalu coba lagi.";
    if (status === 401 || status === 403) return "Sesi habis. Silakan masuk lagi.";
    if (status === 404) return "Data tidak ditemukan.";
    if (status >= 500) return "Server sedang bermasalah. Coba lagi sebentar.";
    return "Terjadi kesalahan. Coba lagi.";
  }

  function query(params) {
    var bagian = [];
    for (var k in params) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
        bagian.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
      }
    }
    return bagian.length ? "?" + bagian.join("&") : "";
  }

  window.LPLPO = {
    sesi: bacaSesi,

    // Masuk sebagai admin PocketBase.
    masuk: function (email, sandi) {
      return minta("POST", "/api/admins/auth-with-password", { identity: email, password: sandi }).then(
        function (d) {
          simpanSesi(d.token, d.admin);
          return d;
        },
        function (err) {
          if (err.status === 400) err.pesan = "Email atau kata sandi salah.";
          throw err;
        }
      );
    },

    // Periksa dan perpanjang sesi. Jika ditolak server, sesi dihapus.
    segarkan: function () {
      return minta("POST", "/api/admins/auth-refresh").then(
        function (d) {
          simpanSesi(d.token, d.admin);
          return d;
        },
        function (err) {
          if (err.status === 401 || err.status === 403) hapusSesi();
          throw err;
        }
      );
    },

    keluar: function () {
      hapusSesi();
    },

    // Daftar record sebuah collection. params: page, perPage, filter, sort, expand
    daftar: function (koleksi, params) {
      return minta("GET", "/api/collections/" + koleksi + "/records" + query(params || {}));
    },

    // Jumlah record (dengan filter opsional) tanpa mengunduh isinya.
    jumlah: function (koleksi, filter) {
      return minta("GET", "/api/collections/" + koleksi + "/records" + query({ page: 1, perPage: 1, filter: filter })).then(
        function (d) { return d.totalItems; }
      );
    },

    buat: function (koleksi, data) {
      return minta("POST", "/api/collections/" + koleksi + "/records", data);
    },

    ubah: function (koleksi, id, data) {
      return minta("PATCH", "/api/collections/" + koleksi + "/records/" + id, data);
    },

    hapus: function (koleksi, id) {
      return minta("DELETE", "/api/collections/" + koleksi + "/records/" + id);
    }
  };
})();
