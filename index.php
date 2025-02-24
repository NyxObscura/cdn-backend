<?php

// Konfigurasi
$githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;  // Ganti dengan token GitHub kamu
$githubUsername = process.env.USERNAME_GITHUB; // Ganti dengan username GitHub
$repoName = process.env.REPO_GITHUB; // Ganti dengan nama repository
$branch = process.env.BRANCH_REPO; // Ganti dengan branch yang digunakan
$githubApiUrl = "https://api.github.com/repos/$githubUsername/$repoName/contents/";

// Fungsi validasi
function isValidUpload($file) {
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif']; // Jenis file yang diizinkan
    $maxSize = 2 * 1024 * 1024; // Maksimal 2MB

    if (!in_array($file['type'], $allowedTypes)) {
        return "File type not allowed.";
    }

    if ($file['size'] > $maxSize) {
        return "File size exceeds limit.";
    }

    return true;
}

// Proses upload
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $file = $_FILES['file'];
    $validation = isValidUpload($file);

    if ($validation !== true) {
        http_response_code(400);
        echo json_encode(["error" => $validation]);
        exit;
    }

    // Baca file dan konversi ke Base64
    $fileContent = file_get_contents($file['tmp_name']);
    $base64Content = base64_encode($fileContent);
    $filePath = "uploads/" . basename($file['name']); // Folder di repo GitHub

    // Persiapkan data untuk GitHub API
    $data = json_encode([
        "message" => "Upload file " . basename($file['name']),
        "content" => $base64Content,
        "branch" => $branch
    ]);

    // Kirim ke GitHub API
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $githubApiUrl . $filePath);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: token $githubToken",
        "User-Agent: PHP-Upload-Script",
        "Accept: application/vnd.github.v3+json"
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 201) {
        $responseData = json_decode($response, true);
        echo json_encode(["success" => true, "url" => $responseData['content']['download_url']]);
    } else {
        echo json_encode(["error" => "Failed to upload to GitHub", "details" => $response]);
    }
} else {
    http_response_code(405);
    echo json_encode(["error" => "Invalid request"]);
}
?>
