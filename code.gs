// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  MOOVIED — Google Apps Script Backend  v4.1                                 ║
// ║  GAS URL: AKfycbwMcrOMCPmRMgbWunm0eQnweODbktt_6yvv8oKR8p61_n4ULAsuCD2wBtokaNPN4VyT ║
// ║  Deploy → Execute as: Me  |  Access: Anyone                                 ║
// ║  GitHub Sync: Comments, Likes, Bookmarks, WatchHistory pushed as JSON CDN   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

var SPREADSHEET_ID = "14Flm-LOjocdd6vBLm5Z3c5GeIW5_W_7mVNikUSubIiI";
var ADMIN_SECRET   = "YOUR_ADMIN_SECRET_HERE";

// ── GitHub Sync Config ────────────────────────────────────────────────────────
// Store your GitHub token in Script Properties:
//   Apps Script editor → Project Settings → Script Properties → Add:
//     Key: GITHUB_TOKEN   Value: ghp_xxxxxxxxxxxx
var GITHUB_OWNER  = "mooviedwebsite";
var GITHUB_REPO   = "Admin-Log-Sync";
var GITHUB_BRANCH = "main";

var MOVIE_FIELDS = [
  "id","title","description","synopsis","poster_url","video_url","yt_link",
  "download_url","dl_2160p","dl_1080p","dl_720p","dl_480p","dl_360p",
  "stream_2160p","stream_1080p","stream_720p","stream_480p","stream_360p",
  "genre","year","views","rating","tmdb_rating","rt_rating",
  "runtime","subtitle_url","director","director_image","cast","gallery",
  "type","episodes"
];

var COMMENT_FIELDS = ["id","movie_id","user_id","user_name","content","timestamp","likes","edited","reply_to","reply_to_name"];

var ADMIN_ACTIONS = [
  "addMovie","editMovie","deleteMovie","getUsers","deleteUser",
  "getActivityLogs","getStats","logActivity","sendEmailToUser","sendEmailToAll",
  "resetCommentsSheet","clearAllComments"
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
  else if (name === "Comments")     headers = COMMENT_FIELDS;
  else if (name === "WatchHistory") headers = ["id","user_id","movie_id","watched_at","progress"];
  else if (name === "Bookmarks")    headers = ["id","user_id","movie_id","bookmarked_at"];
  else if (name === "MovieLikes")   headers = ["id","movie_id","user_id","liked_at"];
  else if (name === "ActivityLogs") headers = ["id","user_id","action","timestamp"];
  else if (name === "AdsConfig")    headers = ["key","value","updated_at"];
  else return;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

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
    if (!data[i][0] && !data[i][1]) continue;
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
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── HTTP: GET ─────────────────────────────────────────────────────────────────

function doGet(e) {
  var action = e.parameter.action;
  var secret = e.parameter.adminSecret || "";
  var result;
  try {
    if (ADMIN_ACTIONS.indexOf(action) >= 0 && !verifyAdminSecret(secret))
      return jsonResponse({ success: false, error: "Unauthorized" });

    if      (action === "getMovies")        result = getMovies();
    else if (action === "getAllData")        result = getAllData();
    else if (action === "getMovieById")     result = getMovieById(e.parameter.id);
    else if (action === "getUsers")         result = getUsers();
    else if (action === "getStats")         result = getStats();
    else if (action === "getActivityLogs")  result = getActivityLogs();
    else if (action === "getComments")      result = getComments(e.parameter.movieId);
    else if (action === "getAllComments")   result = getAllComments();
    else if (action === "getWatchHistory")  result = getWatchHistory(e.parameter.userId);
    else if (action === "getBookmarks")     result = getBookmarks(e.parameter.userId);
    else if (action === "getMovieLikes")    result = getMovieLikes(e.parameter.movieId);
    else if (action === "getAdsConfig")     result = getAdsConfig();
    // Write actions via GET (server sync — uses pre-set id from server)
    else if (action === "addComment")      result = addComment(
      e.parameter.movieId || e.parameter.movie_id,
      e.parameter.userId  || e.parameter.user_id,
      e.parameter.userName || e.parameter.user_name || "Anonymous",
      e.parameter.content,
      e.parameter.reply_to || "",
      e.parameter.reply_to_name || "",
      e.parameter.id
    );
    else if (action === "editComment")     result = editComment(e.parameter.id, e.parameter.content);
    else if (action === "deleteComment")   result = deleteComment(e.parameter.id);
    else if (action === "likeComment")     result = likeComment(e.parameter.id);
    else result = { success: false, error: "Unknown action: " + action };
  } catch(err) { result = { success: false, error: err.toString() }; }
  return jsonResponse(result);
}

// ── HTTP: POST ────────────────────────────────────────────────────────────────

function doPost(e) {
  var body, result;
  try {
    body = JSON.parse(e.postData.contents);
    var action = body.action;
    var secret = body.adminSecret || "";

    if (ADMIN_ACTIONS.indexOf(action) >= 0 && !verifyAdminSecret(secret))
      return jsonResponse({ success: false, error: "Unauthorized" });

    // Accept both snake_case and camelCase for comment fields
    var movieId     = body.movieId     || body.movie_id    || "";
    var userId      = body.userId      || body.user_id     || "";
    var userName    = body.userName    || body.user_name   || "Anonymous";
    var replyTo     = body.reply_to    || body.replyTo     || "";
    var replyToName = body.reply_to_name || body.replyToName || "";

    if      (action === "registerUser")      result = registerUser(body.name, body.email, body.password, body.country);
    else if (action === "loginUser")         result = loginUser(body.email, body.password);
    else if (action === "deleteUser")        result = deleteUser(body.id);
    else if (action === "addMovie")          result = addMovie(body);
    else if (action === "editMovie")         result = editMovie(body);
    else if (action === "deleteMovie")       result = deleteMovie(body.id);
    else if (action === "addViewCount")      result = addViewCount(movieId, userId);
    else if (action === "logActivity")       result = logActivity(userId, body.action);
    else if (action === "addComment")        result = addComment(movieId, userId, userName, body.content, replyTo, replyToName, body.id);
    else if (action === "editComment")       result = editComment(body.id, body.content);
    else if (action === "deleteComment")     result = deleteComment(body.id);
    else if (action === "likeComment")       result = likeComment(body.id);
    else if (action === "addToWatchHistory") result = addToWatchHistory(userId, movieId, body.progress);
    else if (action === "toggleBookmark")    result = toggleBookmark(userId, movieId);
    else if (action === "toggleMovieLike")   result = toggleMovieLike(userId, movieId);
    else if (action === "sendEmailToUser")   result = sendEmailToUser(body.userId, body.subject, body.htmlBody);
    else if (action === "sendEmailToAll")    result = sendEmailToAll(body.subject, body.htmlBody);
    else if (action === "saveAdsConfig")     result = saveAdsConfig(body.config);
    else if (action === "resetCommentsSheet") result = resetCommentsSheet();
    else if (action === "clearAllComments")  result = resetCommentsSheet();
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
  try { sendWelcomeEmail(email, name); } catch(ex) {}
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
// MOVIES
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
  var headers  = data[0];
  var idCol    = headers.indexOf("id");
  var titleCol = headers.indexOf("title");
  var movies   = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[titleCol] && !row[0]) continue;
    if (!row[idCol] && row[titleCol]) {
      var newId = generateId();
      row[idCol] = newId;
      sheet.getRange(i + 1, idCol + 1).setValue(newId);
    }
    if (!row[idCol]) continue;
    movies.push(movieRowToObj(headers, row));
  }
  return { success:true, movies:movies };
}

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
  var incomingFields = Object.keys(data).filter(function(k){ return k!=="action" && k!=="adminSecret"; });
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
  var incomingFields = Object.keys(data).filter(function(k){ return k!=="action" && k!=="adminSecret" && k!=="id"; });
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
// COMMENTS  — fully advanced, GitHub-synced
// ════════════════════════════════════════════════════════════════════════════

function commentToObj(c) {
  var obj = {
    id:        String(c.id        || ""),
    movie_id:  String(c.movie_id  || ""),
    user_id:   String(c.user_id   || ""),
    user_name: String(c.user_name || "Anonymous"),
    content:   String(c.content   || ""),
    timestamp: String(c.timestamp || ""),
    likes:     Number(c.likes)    || 0,
    edited:    c.edited === true  || c.edited === "TRUE" || c.edited === "true"
  };
  if (c.reply_to)      obj.reply_to      = String(c.reply_to);
  if (c.reply_to_name) obj.reply_to_name = String(c.reply_to_name);
  return obj;
}

function getComments(movieId) {
  if (!movieId) return { success: false, error: "movieId required" };
  var sheet = getSheet("Comments");
  ensureColumns(sheet, COMMENT_FIELDS);
  var comments = sheetToObjects(sheet)
    .filter(function(c) { return String(c.movie_id) === String(movieId); })
    .map(commentToObj);
  comments.sort(function(a,b){ return new Date(a.timestamp) - new Date(b.timestamp); });
  return { success:true, comments:comments };
}

function getAllComments() {
  var sheet = getSheet("Comments");
  ensureColumns(sheet, COMMENT_FIELDS);
  var comments = sheetToObjects(sheet).map(commentToObj);
  comments.sort(function(a,b){ return new Date(b.timestamp) - new Date(a.timestamp); });
  return { success:true, comments:comments };
}

function addComment(movieId, userId, userName, content, replyTo, replyToName, externalId) {
  if (!movieId || !userId || !content) return { success:false, error:"movieId, userId and content are required" };
  var sheet = getSheet("Comments");
  ensureColumns(sheet, COMMENT_FIELDS);
  var headers = sheet.getDataRange().getValues()[0];
  // Use server-provided ID so local file and sheet share the same UUID
  var id  = externalId || generateId();
  var now = new Date().toISOString();
  var row = headers.map(function(h) {
    if (h==="id")            return id;
    if (h==="movie_id")      return movieId;
    if (h==="user_id")       return userId;
    if (h==="user_name")     return userName || "Anonymous";
    if (h==="content")       return content;
    if (h==="timestamp")     return now;
    if (h==="likes")         return 0;
    if (h==="edited")        return false;
    if (h==="reply_to")      return replyTo || "";
    if (h==="reply_to_name") return replyToName || "";
    return "";
  });
  sheet.appendRow(row);

  var comment = { id:id, movie_id:movieId, user_id:userId, user_name:userName||"Anonymous",
                  content:content, timestamp:now, likes:0, edited:false };
  if (replyTo)     comment.reply_to      = replyTo;
  if (replyToName) comment.reply_to_name = replyToName;
  try { syncCommentsToGithub(); } catch(ex) {}
  return { success:true, comment:comment };
}

function editComment(id, content) {
  if (!id || !content) return { success:false, error:"id and content required" };
  var sheet   = getSheet("Comments");
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol   = headers.indexOf("id");
  var contCol = headers.indexOf("content");
  var editCol = headers.indexOf("edited");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.getRange(i+1, contCol+1).setValue(content);
      if (editCol >= 0) sheet.getRange(i+1, editCol+1).setValue(true);
      try { syncCommentsToGithub(); } catch(ex) {}
      return { success:true };
    }
  }
  return { success:false, error:"Comment not found." };
}

function deleteComment(id) {
  if (!id) return { success:false, error:"id required" };
  var sheet   = getSheet("Comments");
  var allData = sheet.getDataRange().getValues();
  var idCol   = allData[0].indexOf("id");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.deleteRow(i+1);
      try { syncCommentsToGithub(); } catch(ex) {}
      return { success:true };
    }
  }
  return { success:false, error:"Comment not found." };
}

function likeComment(id) {
  if (!id) return { success:false, error:"id required" };
  var sheet   = getSheet("Comments");
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol   = headers.indexOf("id");
  var likeCol = headers.indexOf("likes");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      var n = (Number(allData[i][likeCol])||0)+1;
      sheet.getRange(i+1, likeCol+1).setValue(n);
      try { syncCommentsToGithub(); } catch(ex) {}
      return { success:true, likes:n };
    }
  }
  return { success:false, error:"Comment not found." };
}

// Admin: wipe the Comments sheet and create a clean one with correct headers
function resetCommentsSheet() {
  var ss = getSpreadsheet();
  var existing = ss.getSheetByName("Comments");

  // Delete the old sheet if it exists
  if (existing) {
    // Can't delete the only sheet, so insert a temp first if needed
    if (ss.getSheets().length === 1) ss.insertSheet("_temp");
    ss.deleteSheet(existing);
  }

  // Create brand new Comments sheet with correct headers
  var newSheet = ss.insertSheet("Comments");
  newSheet.getRange(1, 1, 1, COMMENT_FIELDS.length).setValues([COMMENT_FIELDS]);

  // Style the header row
  var headerRange = newSheet.getRange(1, 1, 1, COMMENT_FIELDS.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#f3f4f6");

  // Remove the temp sheet if we created one
  var temp = ss.getSheetByName("_temp");
  if (temp) ss.deleteSheet(temp);

  try { syncCommentsToGithub(); } catch(ex) {}
  return { success:true, message:"Comments sheet reset. Old data deleted. New sheet ready." };
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

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][userIdCol])===String(userId) && String(allData[i][movieIdCol])===String(movieId)) {
      if (progCol>=0) sheet.getRange(i+1,progCol+1).setValue(progress||0);
      var watchedCol = headers.indexOf("watched_at");
      if (watchedCol>=0) sheet.getRange(i+1,watchedCol+1).setValue(new Date().toISOString());
      return { success:true };
    }
  }
  var id  = generateId();
  var now = new Date().toISOString();
  sheet.appendRow([id, userId, movieId, now, progress||0]);
  return { success:true };
}

function getWatchHistory(userId) {
  var sheet = getSheet("WatchHistory");
  var items = sheetToObjects(sheet).filter(function(r){ return String(r.user_id)===String(userId); });
  return { success:true, history:items };
}

// ════════════════════════════════════════════════════════════════════════════
// BOOKMARKS
// ════════════════════════════════════════════════════════════════════════════

function toggleBookmark(userId, movieId) {
  var sheet   = getSheet("Bookmarks");
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var userCol  = headers.indexOf("user_id");
  var movieCol = headers.indexOf("movie_id");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][userCol])===String(userId) && String(allData[i][movieCol])===String(movieId)) {
      sheet.deleteRow(i+1);
      return { success:true, bookmarked:false };
    }
  }
  sheet.appendRow([generateId(), userId, movieId, new Date().toISOString()]);
  return { success:true, bookmarked:true };
}

function getBookmarks(userId) {
  var items = sheetToObjects(getSheet("Bookmarks")).filter(function(r){ return String(r.user_id)===String(userId); });
  return { success:true, bookmarks:items };
}

// ════════════════════════════════════════════════════════════════════════════
// MOVIE LIKES
// ════════════════════════════════════════════════════════════════════════════

function toggleMovieLike(userId, movieId) {
  var sheet   = getSheet("MovieLikes");
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var userCol  = headers.indexOf("user_id");
  var movieCol = headers.indexOf("movie_id");
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][userCol])===String(userId) && String(allData[i][movieCol])===String(movieId)) {
      sheet.deleteRow(i+1);
      return { success:true, liked:false };
    }
  }
  sheet.appendRow([generateId(), movieId, userId, new Date().toISOString()]);
  return { success:true, liked:true };
}

function getMovieLikes(movieId) {
  var items = sheetToObjects(getSheet("MovieLikes")).filter(function(r){ return String(r.movie_id)===String(movieId); });
  return { success:true, likes:items, count:items.length };
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOGS & STATS
// ════════════════════════════════════════════════════════════════════════════

function logActivity(userId, action) {
  var sheet = getSheet("ActivityLogs");
  sheet.appendRow([generateId(), userId||"", action||"", new Date().toISOString()]);
  return { success:true };
}

function getActivityLogs() {
  var logs = sheetToObjects(getSheet("ActivityLogs"));
  logs.sort(function(a,b){ return new Date(b.timestamp)-new Date(a.timestamp); });
  return { success:true, logs:logs };
}

function getStats() {
  var users    = sheetToObjects(getSheet("Users")).length;
  var movies   = sheetToObjects(getSheet("Movies")).length;
  var comments = sheetToObjects(getSheet("Comments")).length;
  var likes    = sheetToObjects(getSheet("MovieLikes")).length;
  var history  = sheetToObjects(getSheet("WatchHistory")).length;
  return { success:true, stats:{ users:users, movies:movies, comments:comments, likes:likes, watchHistory:history } };
}

// ════════════════════════════════════════════════════════════════════════════
// ADS CONFIG
// ════════════════════════════════════════════════════════════════════════════

function getAdsConfig() {
  var items = sheetToObjects(getSheet("AdsConfig"));
  var config = {};
  items.forEach(function(r){ config[r.key] = r.value; });
  return { success:true, config:config };
}

function saveAdsConfig(config) {
  var sheet = getSheet("AdsConfig");
  var now   = new Date().toISOString();
  var allData = sheet.getDataRange().getValues();
  var headers  = allData[0];
  var keyCol   = headers.indexOf("key");
  Object.keys(config||{}).forEach(function(k) {
    var found = false;
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][keyCol]) === String(k)) {
        sheet.getRange(i+1, headers.indexOf("value")+1).setValue(config[k]);
        sheet.getRange(i+1, headers.indexOf("updated_at")+1).setValue(now);
        found = true; break;
      }
    }
    if (!found) sheet.appendRow([k, config[k], now]);
  });
  return { success:true };
}

// ════════════════════════════════════════════════════════════════════════════
// EMAIL
// ════════════════════════════════════════════════════════════════════════════

function sendWelcomeEmail(email, name) {
  try {
    MailApp.sendEmail({
      to: email,
      subject: "Welcome to MOOVIED!",
      htmlBody: "<h2>Welcome, " + name + "!</h2><p>Your MOOVIED account is ready. Start watching now.</p>"
    });
  } catch(ex) {}
}

function sendEmailToUser(userId, subject, htmlBody) {
  var users = sheetToObjects(getSheet("Users"));
  var user  = users.find(function(u){ return String(u.id)===String(userId); });
  if (!user) return { success:false, error:"User not found." };
  MailApp.sendEmail({ to:user.email, subject:subject, htmlBody:htmlBody });
  return { success:true };
}

function sendEmailToAll(subject, htmlBody) {
  var users = sheetToObjects(getSheet("Users"));
  users.forEach(function(u) {
    try { MailApp.sendEmail({ to:u.email, subject:subject, htmlBody:htmlBody }); } catch(ex){}
  });
  return { success:true, sent:users.length };
}

// ════════════════════════════════════════════════════════════════════════════
// GITHUB SYNC
// ════════════════════════════════════════════════════════════════════════════

function getGithubToken() {
  try { return PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN") || ""; }
  catch(ex) { return ""; }
}

function githubPushJson(filePath, data, message) {
  var token = getGithubToken();
  if (!token) return false;
  var content = Utilities.base64Encode(JSON.stringify(data, null, 2), Utilities.Charset.UTF_8);
  var apiUrl  = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + filePath;

  // Get existing SHA
  var sha = "";
  try {
    var getResp = UrlFetchApp.fetch(apiUrl + "?ref=" + GITHUB_BRANCH, {
      headers: { Authorization:"token "+token, Accept:"application/vnd.github.v3+json" },
      muteHttpExceptions: true
    });
    if (getResp.getResponseCode() === 200) {
      sha = JSON.parse(getResp.getContentText()).sha || "";
    }
  } catch(ex){}

  var payload = { message: message || "Sync via MOOVIED GAS", content: content, branch: GITHUB_BRANCH };
  if (sha) payload.sha = sha;

  var resp = UrlFetchApp.fetch(apiUrl, {
    method: "put",
    headers: { Authorization:"token "+token, Accept:"application/vnd.github.v3+json", "Content-Type":"application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return resp.getResponseCode() === 200 || resp.getResponseCode() === 201;
}

function syncCommentsToGithub() {
  var result = getAllComments();
  if (!result.success) return false;
  return githubPushJson("data/comments.json", result.comments, "Sync: comments updated");
}

function syncAllToGithub() {
  var ok = true;
  try { syncCommentsToGithub(); }      catch(ex){ ok = false; }
  try {
    var likes = sheetToObjects(getSheet("MovieLikes"));
    githubPushJson("data/movie-likes.json", likes, "Sync: movie likes");
  } catch(ex){ ok = false; }
  try {
    var bookmarks = sheetToObjects(getSheet("Bookmarks"));
    githubPushJson("data/bookmarks.json", bookmarks, "Sync: bookmarks");
  } catch(ex){ ok = false; }
  try {
    var history = sheetToObjects(getSheet("WatchHistory"));
    githubPushJson("data/watch-history.json", history, "Sync: watch history");
  } catch(ex){ ok = false; }
  return ok;
}

// Scheduled trigger — set up in GAS triggers (runs/hour or runs/day)
function scheduledSync() {
  syncAllToGithub();
}
