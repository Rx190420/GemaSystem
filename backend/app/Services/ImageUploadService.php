<?php

namespace App\Services;

use App\Exceptions\ImageValidationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Validates an uploaded image and re-encodes it as WebP before it ever
 * touches persistent storage.
 *
 * Security model — read this before changing anything below:
 *
 *   Steps 1-5 (size cap, real MIME sniff, getimagesize(), MIME/type
 *   cross-check, pixel-dimension cap) are cheap fast-fail / DoS guards.
 *   They are NOT the security boundary — an attacker who can forge a
 *   MIME-sniffed header or a getimagesize() result could sail through
 *   all five of them.
 *
 *   The actual defense is step 6: the file is decoded into a GD
 *   in-memory bitmap via imagecreatefromX() and re-encoded from
 *   scratch via imagewebp() into a brand-new, randomly-named file.
 *   Only decoded pixel data survives that round-trip — embedded
 *   PHP/script polyglots, poisoned EXIF blocks, or bytes appended
 *   after a JPEG's EOF marker are all discarded, because GD only
 *   ever reads pixels back out, never the original byte stream.
 *   The original uploaded file is never written to a persistent path;
 *   only this re-encoded output ever reaches storage/.
 */
class ImageUploadService
{
    private const MAX_BYTES = 5 * 1024 * 1024; // 5MB
    private const MIN_DIMENSION = 20;
    private const MAX_DIMENSION = 6000;

    /** Allowed image types: getimagesize() IMAGETYPE_* => expected MIME. */
    private const ALLOWED_TYPES = [
        IMAGETYPE_JPEG => 'image/jpeg',
        IMAGETYPE_PNG  => 'image/png',
        IMAGETYPE_GIF  => 'image/gif',
        IMAGETYPE_WEBP => 'image/webp',
    ];

    /**
     * Validate, re-encode as WebP, and store the file.
     *
     * @return string Relative path within the `public` disk (e.g. "products/12/abc123.webp").
     * @throws ImageValidationException
     */
    public function processAndStore(UploadedFile $file, string $directory, int $quality = 82): string
    {
        if (! $file->isValid()) {
            throw new ImageValidationException('El archivo subido no es válido.');
        }

        if ($file->getSize() === false || $file->getSize() > self::MAX_BYTES) {
            throw new ImageValidationException('La imagen supera el tamaño máximo permitido (5MB).');
        }

        $path = $file->getRealPath();
        if ($path === false || ! is_file($path)) {
            throw new ImageValidationException('El archivo no es una imagen válida.');
        }

        // Real MIME sniff on the actual bytes — never trust the client-supplied
        // mime type or the original filename/extension.
        $finfo       = finfo_open(FILEINFO_MIME_TYPE);
        $sniffedMime = finfo_file($finfo, $path);
        finfo_close($finfo);

        if (! in_array($sniffedMime, self::ALLOWED_TYPES, true)) {
            throw new ImageValidationException('Formato de imagen no permitido. Usa JPG, PNG, GIF o WEBP.');
        }

        $info = @getimagesize($path);
        if ($info === false || ! isset(self::ALLOWED_TYPES[$info[2]])) {
            throw new ImageValidationException('El archivo no es una imagen válida.');
        }

        // Cross-check: the sniffed MIME must agree with the type getimagesize() reports.
        if (self::ALLOWED_TYPES[$info[2]] !== $sniffedMime) {
            throw new ImageValidationException('El archivo no es una imagen válida.');
        }

        [$width, $height] = $info;
        if ($width < self::MIN_DIMENSION || $height < self::MIN_DIMENSION
            || $width > self::MAX_DIMENSION || $height > self::MAX_DIMENSION) {
            throw new ImageValidationException('Las dimensiones de la imagen no son válidas.');
        }

        // ── The actual security boundary: decode then re-encode from scratch ──
        $image = $this->decode($info[2], $path);
        if ($image === false) {
            throw new ImageValidationException('No se pudo procesar la imagen. Intenta con otro archivo.');
        }

        imagealphablending($image, true);
        imagesavealpha($image, true);

        $directory = trim($directory, '/');
        $filename  = Str::random(40) . '.webp';
        $relative  = "{$directory}/{$filename}";

        Storage::disk('public')->makeDirectory($directory);
        $destination = Storage::disk('public')->path($relative);

        $ok = imagewebp($image, $destination, $quality);
        imagedestroy($image);

        if (! $ok) {
            throw new ImageValidationException('No se pudo guardar la imagen. Intenta nuevamente.');
        }

        return $relative;
    }

    public function delete(?string $relativePath): void
    {
        if ($relativePath) {
            Storage::disk('public')->delete($relativePath);
        }
    }

    /** @return \GdImage|false */
    private function decode(int $imageType, string $path)
    {
        return match ($imageType) {
            IMAGETYPE_JPEG => @imagecreatefromjpeg($path),
            IMAGETYPE_PNG  => @imagecreatefrompng($path),
            IMAGETYPE_GIF  => @imagecreatefromgif($path),
            IMAGETYPE_WEBP => @imagecreatefromwebp($path),
            default        => false,
        };
    }
}
