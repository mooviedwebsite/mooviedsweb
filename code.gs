// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  MOOVIED — Google Apps Script Backend  v3.0                                 ║
// ║  Deploy → Execute as: Me  |  Access: Anyone                                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

var SPREADSHEET_ID = "14Flm-LOjocdd6vBLm5Z3c5GeIW5_W_7mVNikUSubIiI";
var ADMIN_SECRET   = "YOUR_ADMIN_SECRET_HERE"; // optional: set a long random string

// All supported movie/series fields — new ones are auto-added as sheet columns
var MOVIE_FIELDS = [
  "id","title","description","synopsis","poster_url","video_url","yt_link",
  "download_url","dl_2160p","dl_1080p","dl_720p","dl_480p","dl_360p",
  "stream_2160p","stream_1080p","stream_720p","stream_480p","stream_360p",
  "genre","year","views","rating","tmdb_rating","rt_rating",
  "runtime","subtitle_url","director","director_image","cast","gallery",
  "type","episodes"
];

var ADMIN_ACTIONS = [
  "addMovie","editMovie","deleteMovie","getUsers","deleteUser",
  "getActivityLogs","getStats","logActivity","sendEmailToUser","sendEmailToAll"
];

// ── Sheet helpers ─────────────────────────────────────────────────────────────

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheetHeaders(sheet, name);
  }
  return sheet;
}

function initSheetHeaders(sheet, name) {
  var headers;
  if      (name === "Users")        headers = ["id","name","email","password","country","created_at"];
  else if (name === "Movies")       headers = MOVIE_FIELDS;
  else if (name === "Comments")     headers = ["id","movie_id","user_id","user_name","content","timestamp","likes","edited","reply_to","reply_to_name"];
  else if (name === "WatchHistory") headers = ["id","user_id","movie_id","watched_at","progress"];
  else if (name === "Bookmarks")    headers = ["id","user_id","movie_id","bookmarked_at"];
  else if (name === "MovieLikes")   headers = ["id","movie_id","user_id","liked_at"];
  else if (name === "ActivityLogs") headers = ["id","user_id","action","timestamp"];
  else if (name === "AdsConfig")    headers = ["key","value","updated_at"];
  else return;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

// Auto-detect and add any new columns that don't exist yet
function ensureColumns(sheet, requiredFields) {
  var data = sheet.getDataRange().getValues();
  var headers = data.length > 0 ? data[0].map(String) : [];
  var added = false;
  requiredFields.forEach(function(f) {
    if (f && headers.indexOf(String(f)) === -1) {
      headers.push(String(f));
      added = true;
    }
  });
  if (added) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return headers;
}

function generateId() { return Utilities.getUuid(); }

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0] && !data[i][1]) continue; // skip blank rows
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = (data[i][j] !== undefined && data[i][j] !== null) ? data[i][j] : "";
    }
    result.push(obj);
  }
  return result;
}

function verifyAdminSecret(s) {
  if (!ADMIN_SECRET || ADMIN_SECRET === "YOUR_ADMIN_SECRET_HERE") return true;
  return s === ADMIN_SECRET;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ── HTTP: GET ────────────────────────────────────────────────────────────────

function doGet(e) {
  var action = e.parameter.action;
  var secret = e.parameter.adminSecret || "";
  var result;
  try {
    if (ADMIN_ACTIONS.indexOf(action) >= 0 && !verifyAdminSecret(secret))
      return jsonResponse({ success: false, error: "Unauthorized" });

    if      (action === "getMovies")      result = getMovies();
    else if (action === "getAllData")     result = getAllData();
    else if (action === "getMovieById")  result = getMovieById(e.parameter.id);
    else if (action === "getUsers")      result = getUsers();
    else if (action === "getStats")      result = getStats();
    else if (action === "getActivityLogs") result = getActivityLogs();
    else if (action === "getComments")   result = getComments(e.parameter.movieId);
    else if (action === "getAllComments")result = getAllComments();
    else if (action === "getWatchHistory") result = getWatchHistory(e.parameter.userId);
    else if (action === "getBookmarks")  result = getBookmarks(e.parameter.userId);
    else if (action === "getMovieLikes") result = getMovieLikes(e.parameter.movieId);
    else if (action === "getAdsConfig")  result = getAdsConfig();
    else result = { success: false, error: "Unknown action: " + action };
  } catch(err) { result = { success: false, error: err.toString() }; }
  return jsonResponse(result);
}

// ── HTTP: POST ───────────────────────────────────────────────────────────────

function doPost(e) {
  var body, result;
  try {
    body = JSON.parse(e.postData.contents);
    var action = body.action;
    var secret = body.adminSecret || "";

    if (ADMIN_ACTIONS.indexOf(action) >= 0 && !verifyAdminSecret(secret))
      return jsonResponse({ success: false, error: "Unauthorized" });

    if      (action === "registerUser")    result = registerUser(body.name, body.email, body.password, body.country);
    else if (action === "loginUser")       result = loginUser(body.email, body.password);
    else if (action === "deleteUser")      result = deleteUser(body.id);
    else if (action === "addMovie")        result = addMovie(body);
    else if (action === "editMovie")       result = editMovie(body);
    else if (action === "deleteMovie")     result = deleteMovie(body.id);
    else if (action === "addViewCount")    result = addViewCount(body.movieId, body.userId);
    else if (action === "logActivity")     result = logActivity(body.userId, body.action);
    else if (action === "addComment")      result = addComment(body.movieId, body.userId, body.userName, body.content, body.reply_to, body.reply_to_name);
    else if (action === "editComment")     result = editComment(body.id, body.content);
    else if (action === "deleteComment")   result = deleteComment(body.id);
    else if (action === "likeComment")     result = likeComment(body.id);
    else if (action === "addToWatchHistory") result = addToWatchHistory(body.userId, body.movieId, body.progress);
    else if (action === "toggleBookmark")  result = toggleBookmark(body.userId, body.movieId);
    else if (action === "toggleMovieLike") result = toggleMovieLike(body.userId, body.movieId);
    else if (action === "sendEmailToUser") result = sendEmailToUser(body.userId, body.subject, body.htmlBody);
    else if (action === "sendEmailToAll")  result = sendEmailToAll(body.subject, body.htmlBody);
    else if (action === "saveAdsConfig")  result = saveAdsConfig(body.config);
    else result = { success: false, error: "Unknown action: " + action };
  } catch(err) { result = { success: false, error: err.toString() }; }
  return jsonResponse(result);
}

// ════════════════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════════════════

function hashPassword(pw) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw, Utilities.Charset.UTF_8);
  return raw.map(function(b) { return ('0'+(b&0xFF).toString(16)).slice(-2); }).join('');
}

function registerUser(name, email, password, country) {
  var sheet = getSheet("Users");
  var users = sheetToObjects(sheet);
  if (users.find(function(u) { return u.email === email; }))
    return { success: false, error: "Email already registered." };

  var id = generateId();
  var now = new Date().toISOString();
  sheet.appendRow([id, name, email, hashPassword(password), country, now]);

  // Send welcome email (non-blocking)
  try { sendWelcomeEkkkjkjjjjkjookkmail(email, name); } catch(ex) {}

  return { success: true, user: { id:id, name:name, email:email, country:country, created_at:now } };
}

function loginUser(email, password) {
  var users = sheetToObjects(getSheet("Users"));
  var hashed = hashPassword(password);
  var user = users.find(function(u) { return u.email === email && u.password === hashed; });
  if (!user) return { success: false, error: "Invalid email or password." };
  return { success: true, user: { id:user.id, name:user.name, email:user.email, country:user.country, created_at:user.created_at } };
}

function getUsers() {
  var users = sheetToObjects(getSheet("Users")).map(function(u) {
    return { id:u.id, name:u.name, email:u.email, country:u.country, created_at:u.created_at };
  });
  return { success: true, users: users };
}

function deleteUser(id) {
  var sheet = getSheet("Users");
  var allData = sheet.getDataRange().getValues();
  var idCol = allData[0].indexOf("id");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) { sheet.deleteRow(i+1); return { success:true }; }
  }
  return { success: false, error: "User not found." };
}

// ════════════════════════════════════════════════════════════════════════════
// MOVIES  (auto-column detection on every write)
// ════════════════════════════════════════════════════════════════════════════

function movieRowToObj(headers, row) {
  var o = {};
  headers.forEach(function(h,j) { o[h] = row[j] !== undefined && row[j] !== null ? row[j] : ""; });
  return {
    id:             String(o.id             || ""),
    title:          String(o.title          || ""),
    description:    String(o.description    || ""),
    synopsis:       String(o.synopsis       || ""),
    poster_url:     String(o.poster_url     || ""),
    video_url:      String(o.video_url      || ""),
    yt_link:        String(o.yt_link        || ""),
    download_url:   String(o.download_url   || ""),
    dl_2160p:       String(o.dl_2160p       || ""),
    dl_1080p:       String(o.dl_1080p       || ""),
    dl_720p:        String(o.dl_720p        || ""),
    dl_480p:        String(o.dl_480p        || ""),
    dl_360p:        String(o.dl_360p        || ""),
    stream_2160p:   String(o.stream_2160p   || ""),
    stream_1080p:   String(o.stream_1080p   || ""),
    stream_720p:    String(o.stream_720p    || ""),
    stream_480p:    String(o.stream_480p    || ""),
    stream_360p:    String(o.stream_360p    || ""),
    genre:          String(o.genre          || ""),
    year:           String(o.year           || ""),
    views:          Number(o.views)         || 0,
    rating:         Number(o.rating)        || 0,
    tmdb_rating:    Number(o.tmdb_rating)   || 0,
    rt_rating:      Number(o.rt_rating)     || 0,
    runtime:        String(o.runtime        || ""),
    subtitle_url:   String(o.subtitle_url   || ""),
    director:       String(o.director       || ""),
    director_image: String(o.director_image || ""),
    cast:           String(o.cast           || ""),
    gallery:        String(o.gallery        || ""),
    type:           String(o.type           || "movie"),
    episodes:       String(o.episodes       || "")
  };
}

function getMovies() {
  var sheet = getSheet("Movies");
  ensureColumns(sheet, MOVIE_FIELDS);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success:true, movies:[] };
  var headers = data[0];
  var idCol    = headers.indexOf("id");
  var titleCol = headers.indexOf("title");
  var movies   = [];
  var needsWrite = false;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Skip completely blank rows
    if (!row[titleCol] && !row[0]) continue;

    // Auto-generate ID for rows that have a title but no ID
    if (!row[idCol] && row[titleCol]) {
      var newId = generateId();
      row[idCol] = newId;
      sheet.getRange(i + 1, idCol + 1).setValue(newId);
      needsWrite = true;
    }

    if (!row[idCol]) continue; // still no id — skip
    movies.push(movieRowToObj(headers, row));
  }

  return { success:true, movies:movies };
}

// One-request endpoint: movies + like counts + comment counts
function getAllData() {
  var result = getMovies();
  var movies = result.movies;

  var likeCounts = {}, commCounts = {};
  try {
    sheetToObjects(getSheet("MovieLikes")).forEach(function(l) {
      likeCounts[l.movie_id] = (likeCounts[l.movie_id]||0)+1;
    });
  } catch(ex) {}
  try {
    sheetToObjects(getSheet("Comments")).forEach(function(c) {
      commCounts[c.movie_id] = (commCounts[c.movie_id]||0)+1;
    });
  } catch(ex) {}

  movies.forEach(function(m) {
    m.like_count    = likeCounts[m.id] || 0;
    m.comment_count = commCounts[m.id] || 0;
  });
  return { success:true, movies:movies };
}

function getMovieById(id) {
  var sheet = getSheet("Movies");
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success:false, error:"Movie not found." };
  var headers = data[0];
  var idCol = headers.indexOf("id");
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id))
      return { success:true, movie: movieRowToObj(headers, data[i]) };
  }
  return { success:false, error:"Movie not found." };
}

function addMovie(data) {
  var sheet = getSheet("Movies");
  // Auto-add any new fields coming from admin panel
  var incomingFields = Object.keys(data).filter(function(k){
    return k!=="action" && k!=="adminSecret";
  });
  var headers = ensureColumns(sheet, MOVIE_FIELDS.concat(incomingFields));

  var id = generateId();
  var row = headers.map(function(h) {
    if (h === "id")    return id;
    if (h === "views") return 0;
    if (h === "year")  return data[h] || String(new Date().getFullYear());
    return data[h] !== undefined ? data[h] : "";
  });
  sheet.appendRow(row);
  return { success:true, id:id };
}

function editMovie(data) {
  var sheet = getSheet("Movies");
  // Auto-add any new fields the admin is trying to save
  var incomingFields = Object.keys(data).filter(function(k){
    return k!=="action" && k!=="adminSecret" && k!=="id";
  });
  ensureColumns(sheet, MOVIE_FIELDS.concat(incomingFields));

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol   = headers.indexOf("id");

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var row = i + 1;
      headers.forEach(function(h, j) {
        if (h !== "id" && h !== "views" && data[h] !== undefined) {
          sheet.getRange(row, j+1).setValue(data[h]);
        }
      });
      return { success:true };
    }
  }
  return { success:false, error:"Movie not found." };
}

function deleteMovie(id) {
  var sheet = getSheet("Movies");
  var allData = sheet.getDataRange().getValues();
  var idCol = allData[0].indexOf("id");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) { sheet.deleteRow(i+1); return { success:true }; }
  }
  return { success:false, error:"Movie not found." };
}

function addViewCount(movieId, userId) {
  var sheet = getSheet("Movies");
  var allData = sheet.getDataRange().getValues();
  var headers  = allData[0];
  var idCol    = headers.indexOf("id");
  var viewsCol = headers.indexOf("views");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(movieId)) {
      sheet.getRange(i+1, viewsCol+1).setValue((Number(allData[i][viewsCol])||0)+1);
      if (userId) { try { logActivity(userId, "watch:"+movieId); } catch(ex){} }
      return { success:true };
    }
  }
  return { success:false, error:"Movie not found." };
}

// ════════════════════════════════════════════════════════════════════════════
// COMMENTS  (server-side — shared across all users)
// ════════════════════════════════════════════════════════════════════════════

function commentToObj(c) {
  var obj = {
    id: String(c.id), movie_id: String(c.movie_id),
    user_id: String(c.user_id), user_name: String(c.user_name),
    content: String(c.content), timestamp: String(c.timestamp),
    likes: Number(c.likes)||0, edited: c.edited===true||c.edited==="TRUE"
  };
  if (c.reply_to)      obj.reply_to      = String(c.reply_to);
  if (c.reply_to_name) obj.reply_to_name = String(c.reply_to_name);
  return obj;
}

function getComments(movieId) {
  var sheet = getSheet("Comments");
  ensureColumns(sheet, ["id","movie_id","user_id","user_name","content","timestamp","likes","edited","reply_to","reply_to_name"]);
  var comments = sheetToObjects(sheet)
    .filter(function(c) { return String(c.movie_id) === String(movieId); })
    .map(commentToObj);
  comments.sort(function(a,b){ return new Date(a.timestamp)-new Date(b.timestamp); });
  return { success:true, comments:comments };
}

// Admin: get all comments across all movies
function getAllComments() {
  var sheet = getSheet("Comments");
  ensureColumns(sheet, ["id","movie_id","user_id","user_name","content","timestamp","likes","edited","reply_to","reply_to_name"]);
  var comments = sheetToObjects(sheet).map(commentToObj);
  comments.sort(function(a,b){ return new Date(b.timestamp)-new Date(a.timestamp); });
  return { success:true, comments:comments };
}

function addComment(movieId, userId, userName, content, replyTo, replyToName) {
  var sheet = getSheet("Comments");
  ensureColumns(sheet, ["id","movie_id","user_id","user_name","content","timestamp","likes","edited","reply_to","reply_to_name"]);
  var headers = sheet.getDataRange().getValues()[0];
  var id  = generateId();
  var now = new Date().toISOString();
  var row = headers.map(function(h) {
    if (h==="id")           return id;
    if (h==="movie_id")     return movieId;
    if (h==="user_id")      return userId;
    if (h==="user_name")    return userName;
    if (h==="content")      return content;
    if (h==="timestamp")    return now;
    if (h==="likes")        return 0;
    if (h==="edited")       return false;
    if (h==="reply_to")     return replyTo || "";
    if (h==="reply_to_name") return replyToName || "";
    return "";
  });
  sheet.appendRow(row);
  var comment = { id:id, movie_id:movieId, user_id:userId, user_name:userName, content:content, timestamp:now, likes:0, edited:false };
  if (replyTo)      comment.reply_to      = replyTo;
  if (replyToName)  comment.reply_to_name = replyToName;
  return { success:true, comment:comment };
}

function editComment(id, content) {
  var sheet   = getSheet("Comments");
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol   = headers.indexOf("id");
  var contCol = headers.indexOf("content");
  var editCol = headers.indexOf("edited");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.getRange(i+1, contCol+1).setValue(content);
      sheet.getRange(i+1, editCol+1).setValue(true);
      return { success:true };
    }
  }
  return { success:false, error:"Comment not found." };
}

function deleteComment(id) {
  var sheet   = getSheet("Comments");
  var allData = sheet.getDataRange().getValues();
  var idCol   = allData[0].indexOf("id");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) { sheet.deleteRow(i+1); return { success:true }; }
  }
  return { success:false, error:"Comment not found." };
}

function likeComment(id) {
  var sheet   = getSheet("Comments");
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol   = headers.indexOf("id");
  var likeCol = headers.indexOf("likes");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      var n = (Number(allData[i][likeCol])||0)+1;
      sheet.getRange(i+1, likeCol+1).setValue(n);
      return { success:true, likes:n };
    }
  }
  return { success:false, error:"Comment not found." };
}

// ════════════════════════════════════════════════════════════════════════════
// WATCH HISTORY
// ════════════════════════════════════════════════════════════════════════════

function addToWatchHistory(userId, movieId, progress) {
  var sheet   = getSheet("WatchHistory");
  var allData = sheet.getDataRange().getValues();
  if (allData.length === 0) { initSheetHeaders(sheet,"WatchHistory"); allData = sheet.getDataRange().getValues(); }
  var headers    = allData[0];
  var userIdCol  = headers.indexOf("user_id");
  var movieIdCol = headers.indexOf("movie_id");
  var progCol    = headers.indexOf("progress");
  var watCol     = headers.indexOf("watched_at");
  var now        = new Date().toISOString();

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][userIdCol]) === String(userId) && String(allData[i][movieIdCol]) === String(movieId)) {
      sheet.getRange(i+1, watCol+1).setValue(now);
      if (progress !== undefined) sheet.getRange(i+1, progCol+1).setValue(progress);
      return { success:true };
    }
  }
  sheet.appendRow([generateId(), userId, movieId, now, progress||0]);
  return { success:true };
}

function getWatchHistory(userId) {
  var history = sheetToObjects(getSheet("WatchHistory"))
    .filter(function(h) { return String(h.user_id)===String(userId); })
    .map(function(h) { return { movie_id:String(h.movie_id), watched_at:String(h.watched_at), progress:Number(h.progress)||0 }; });
  history.sort(function(a,b){ return new Date(b.watched_at)-new Date(a.watched_at); });
  return { success:true, history:history };
}

// ════════════════════════════════════════════════════════════════════════════
// BOOKMARKS
// ════════════════════════════════════════════════════════════════════════════

function toggleBookmark(userId, movieId) {
  var sheet   = getSheet("Bookmarks");
  var allData = sheet.getDataRange().getValues();
  if (allData.length === 0) { initSheetHeaders(sheet,"Bookmarks"); allData = sheet.getDataRange().getValues(); }
  var headers    = allData[0];
  var userIdCol  = headers.indexOf("user_id");
  var movieIdCol = headers.indexOf("movie_id");

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][userIdCol]) === String(userId) && String(allData[i][movieIdCol]) === String(movieId)) {
      sheet.deleteRow(i+1);
      return { success:true, bookmarked:false };
    }
  }
  sheet.appendRow([generateId(), userId, movieId, new Date().toISOString()]);
  return { success:true, bookmarked:true };
}

function getBookmarks(userId) {
  var bookmarks = sheetToObjects(getSheet("Bookmarks"))
    .filter(function(b){ return String(b.user_id)===String(userId); })
    .map(function(b){ return { movie_id:String(b.movie_id), bookmarked_at:String(b.bookmarked_at) }; });
  return { success:true, bookmarks:bookmarks };
}

// ════════════════════════════════════════════════════════════════════════════
// MOVIE LIKES
// ════════════════════════════════════════════════════════════════════════════

function toggleMovieLike(userId, movieId) {
  var sheet   = getSheet("MovieLikes");
  var allData = sheet.getDataRange().getValues();
  if (allData.length === 0) { initSheetHeaders(sheet,"MovieLikes"); allData = sheet.getDataRange().getValues(); }
  var headers    = allData[0];
  var userIdCol  = headers.indexOf("user_id");
  var movieIdCol = headers.indexOf("movie_id");

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][userIdCol]) === String(userId) && String(allData[i][movieIdCol]) === String(movieId)) {
      sheet.deleteRow(i+1);
      var cnt = sheetToObjects(getSheet("MovieLikes")).filter(function(l){ return String(l.movie_id)===String(movieId); }).length;
      return { success:true, liked:false, count:cnt };
    }
  }
  sheet.appendRow([generateId(), movieId, userId, new Date().toISOString()]);
  var cnt2 = sheetToObjects(getSheet("MovieLikes")).filter(function(l){ return String(l.movie_id)===String(movieId); }).length;
  return { success:true, liked:true, count:cnt2 };
}

function getMovieLikes(movieId) {
  var likes = sheetToObjects(getSheet("MovieLikes")).filter(function(l){ return String(l.movie_id)===String(movieId); });
  return { success:true, count:likes.length };
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOGS
// ════════════════════════════════════════════════════════════════════════════

function logActivity(userId, action) {
  getSheet("ActivityLogs").appendRow([generateId(), userId, action, new Date().toISOString()]);
  return { success:true };
}

function getActivityLogs() {
  var logs = sheetToObjects(getSheet("ActivityLogs")).map(function(l){
    return { id:String(l.id), user_id:String(l.user_id), action:String(l.action), timestamp:String(l.timestamp) };
  });
  logs.reverse();
  return { success:true, logs:logs };
}

// ════════════════════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════════════════════════

function getStats() {
  var users    = sheetToObjects(getSheet("Users"));
  var movies   = sheetToObjects(getSheet("Movies"));
  var comments = sheetToObjects(getSheet("Comments"));
  var totalViews = movies.reduce(function(s,m){ return s+(Number(m.views)||0); }, 0);
  return { success:true, totalUsers:users.length, totalMovies:movies.length, totalViews:totalViews, totalComments:comments.length };
}

// ════════════════════════════════════════════════════════════════════════════
// EMAIL SYSTEM
// ════════════════════════════════════════════════════════════════════════════

function welcomeEmailHtml(name, email) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
    + '.w{background:#0a0a0a;padding:40px 16px}.card{background:#111;border:1px solid #222;border-radius:18px;max-width:520px;margin:0 auto;overflow:hidden}'
    + '.hdr{background:#000;padding:28px 32px;border-bottom:1px solid #1c1c1c;text-align:center}'
    + '.logo{font-size:26px;font-weight:900;letter-spacing:-1px;color:#fff}'
    + '.logo span{color:#FBBF24}'
    + '.body{padding:36px 32px}'
    + '.hi{font-size:21px;font-weight:700;color:#fff;margin-bottom:10px}'
    + '.msg{font-size:14px;color:#666;line-height:1.75;margin-bottom:24px}'
    + '.feats{background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:18px 20px;margin-bottom:26px}'
    + '.feat{display:flex;align-items:center;margin-bottom:10px}'
    + '.feat:last-child{margin-bottom:0}'
    + '.dot{width:5px;height:5px;background:#FBBF24;border-radius:50%;margin-right:12px;flex-shrink:0}'
    + '.ft{font-size:13px;color:#999}'
    + '.btn{display:block;background:#FBBF24;color:#000!important;text-decoration:none;font-weight:800;font-size:14px;text-align:center;padding:14px;border-radius:10px;letter-spacing:.3px}'
    + '.ftr{background:#000;padding:18px 32px;border-top:1px solid #1c1c1c;text-align:center}'
    + '.ftxt{font-size:11px;color:#2e2e2e;line-height:1.6}'
    + '</style></head><body><div class="w"><div class="card">'
    + '<div class="hdr"><div class="logo">MOOV<span>IED</span></div></div>'
    + '<div class="body">'
    + '<div class="hi">Welcome, ' + name + '</div>'
    + '<p class="msg">Your MOOVIED account is ready. Stream thousands of movies, download in up to 4K, track your history, and join the community.</p>'
    + '<div class="feats">'
    + '<div class="feat"><div class="dot"></div><div class="ft">Stream &amp; download up to 4K Ultra HD</div></div>'
    + '<div class="feat"><div class="dot"></div><div class="ft">Bookmark your favourite movies</div></div>'
    + '<div class="feat"><div class="dot"></div><div class="ft">Personal watch history synced across devices</div></div>'
    + '<div class="feat"><div class="dot"></div><div class="ft">Comment, like, and join the conversation</div></div>'
    + '</div>'
    + '<a href="https://mooviedwebsite.github.io/Admin-Log-Sync" class="btn">Start Watching</a>'
    + '</div>'
    + '<div class="ftr"><p class="ftxt">You registered with ' + email + '<br>MOOVIED &middot; All rights reserved</p></div>'
    + '</div></div></body></html>';
}

function wrapAdminEmail(htmlContent, recipientName) {
  var greeting = recipientName
    ? '<p style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px">Hello, ' + recipientName + '</p>'
    : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
    + '.w{background:#0a0a0a;padding:40px 16px}.card{background:#111;border:1px solid #222;border-radius:18px;max-width:520px;margin:0 auto;overflow:hidden}'
    + '.hdr{background:#000;padding:22px 32px;border-bottom:1px solid #1c1c1c}'
    + '.logo{font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px}'
    + '.logo span{color:#FBBF24}'
    + '.body{padding:32px}'
    + '.content{font-size:15px;color:#aaa;line-height:1.75;white-space:pre-wrap}'
    + '.ftr{background:#000;padding:18px 32px;border-top:1px solid #1c1c1c;text-align:center}'
    + '.ftxt{font-size:11px;color:#2e2e2e}'
    + '</style></head><body><div class="w"><div class="card">'
    + '<div class="hdr"><div class="logo">MOOV<span>IED</span></div></div>'
    + '<div class="body">' + greeting + '<div class="content">' + htmlContent + '</div></div>'
    + '<div class="ftr"><p class="ftxt">MOOVIED &middot; Official Platform Message</p></div>'
    + '</div></div></body></html>';
}

function sendWelcomeEmail(email, name) {
  MailApp.sendEmail({ to: email, subject: "Welcome to MOOVIED — Start Streaming", htmlBody: welcomeEmailHtml(name, email), name: "MOOVIED" });
}

function sendEmailToUser(userId, subject, htmlBody) {
  var users = sheetToObjects(getSheet("Users"));
  var user  = users.find(function(u){ return String(u.id)===String(userId); });
  if (!user) return { success:false, error:"User not found." };
  MailApp.sendEmail({ to: user.email, subject: subject, htmlBody: wrapAdminEmail(htmlBody, user.name), name: "MOOVIED" });
  try { logActivity(userId, "received_email:"+subject); } catch(ex){}
  return { success:true };
}

function sendEmailToAll(subject, htmlBody) {
  var users = sheetToObjects(getSheet("Users"));
  var sent  = 0;
  users.forEach(function(u) {
    try {
      MailApp.sendEmail({ to: u.email, subject: subject, htmlBody: wrapAdminEmail(htmlBody, u.name), name: "MOOVIED" });
      sent++;
    } catch(ex){}
  });
  return { success:true, sent:sent, total:users.length };
}

// ════════════════════════════════════════════════════════════════════════════
// ADS CONFIG  — stored in "AdsConfig" sheet (one row per key, visible in sheet)
//              Also mirrored in PropertiesService for fast reads
// ════════════════════════════════════════════════════════════════════════════

function getAdsConfig() {
  // Fast path: PropertiesService
  try {
    var props = PropertiesService.getScriptProperties();
    var raw   = props.getProperty("moovied_ads_config");
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && Object.keys(parsed).length > 0) {
        return { success: true, config: parsed };
      }
    }
  } catch(ex) {}

  // Fallback: read from AdsConfig sheet
  try {
    var sheet = getSheet("AdsConfig");
    var data  = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, config: {} };
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === "ads_config" && data[i][1]) {
        return { success: true, config: JSON.parse(String(data[i][1])) };
      }
    }
  } catch(ex) {}

  return { success: true, config: {} };
}

function saveAdsConfig(config) {
  if (!config || typeof config !== "object")
    return { success: false, error: "Invalid config" };

  var json = JSON.stringify(config);
  var now  = new Date().toISOString();

  // Save to PropertiesService (fast reads)
  try {
    PropertiesService.getScriptProperties().setProperty("moovied_ads_config", json);
  } catch(ex) {}

  // Save to AdsConfig sheet (visible in spreadsheet)
  try {
    var sheet   = getSheet("AdsConfig");
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][0]) === "ads_config") {
        sheet.getRange(i + 1, 2).setValue(json);
        sheet.getRange(i + 1, 3).setValue(now);
        return { success: true };
      }
    }
    // Row doesn't exist yet — append it
    sheet.appendRow(["ads_config", json, now]);
  } catch(ex) {
    return { success: false, error: ex.toString() };
  }

  return { success: true };
}

// ════════════════════════════════════════════════════════════════════════════
// SETUP  — run once from the Apps Script editor
// ════════════════════════════════════════════════════════════════════════════

function setupSheets() {
  ["Users","Movies","Comments","WatchHistory","Bookmarks","MovieLikes","ActivityLogs","AdsConfig"]
    .forEach(function(name){ getSheet(name); });
  Logger.log("All sheets initialised successfully.");
}
 