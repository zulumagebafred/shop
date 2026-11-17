import React, { useState } from 'react';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { OWNER_EMAIL, auth, db } from '../lib/firebase';

function normalizeCategory(rawCategory, combinedName) {
  if (rawCategory === 'Men' || rawCategory === 'Women' || rawCategory === 'Unisex') {
    return rawCategory;
  }
  const text = `${rawCategory} ${combinedName}`.toLowerCase();
  if (/\b(female|women|woman|lady|ladies|her|girl)\b/.test(text)) {
    return 'Women';
  }
  if (/\b(male|men|man|him|his|pour homme|homme)\b/.test(text)) {
    return 'Men';
  }
  return 'Unisex';
}

function readNum(fieldObj, fallback = 0) {
  if (!fieldObj || typeof fieldObj !== 'object') return fallback;
  const raw = fieldObj.integerValue ?? fieldObj.doubleValue;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function buildSizes(pricingFields, scentSize, inStock) {
  const fullSizeLabel = `${String(scentSize || '100').replace(/[^0-9]/g, '') || '100'}ml`;
  const retailRaw = Math.min(100000, Math.max(0, readNum(pricingFields.retailPrice, 650)));
  const promoRaw = Math.min(100000, Math.max(0, readNum(pricingFields.newPrice, 0)));
  const fullPrice = promoRaw > 0 ? promoRaw : retailRaw;

  const p5 = Math.min(100000, Math.max(0, readNum(pricingFields.scent5ml, 0)));
  const p10 = Math.min(100000, Math.max(0, readNum(pricingFields.scent10ml, 0)));
  const p50 = Math.min(100000, Math.max(0, readNum(pricingFields.scent50ml, 0)));

  const sizes = [
    { size: '5ml', available: p5 > 0 && inStock, price: p5 > 0 ? p5 : null },
    { size: '10ml', available: p10 > 0 && inStock, price: p10 > 0 ? p10 : null },
    { size: '22ml', available: false, price: null },
  ];

  if (p50 > 0 && fullSizeLabel !== '50ml') {
    sizes.push({ size: '50ml', available: inStock, price: p50 });
  }

  sizes.push({
    size: fullSizeLabel.slice(0, 24),
    available: inStock && fullPrice > 0,
    price: fullPrice > 0 ? fullPrice : 650,
  });

  return sizes;
}

export default function MigrateDataButton() {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const runMigration = async () => {
    setErrorMessage('');
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.emailVerified) {
      setErrorMessage(
        `Sign in to the Owner Console below with verified account (${OWNER_EMAIL}) before running catalog migration.`
      );
      setConfirming(false);
      return;
    }

    setConfirming(false);
    setRunning(true);
    setStatusMessage('Loading old_catalog.json...');

    try {
      const { default: oldCatalog } = await import('../old_catalog.json');
      if (!Array.isArray(oldCatalog) || oldCatalog.length === 0) {
        setErrorMessage('old_catalog.json has no entries to migrate.');
        setRunning(false);
        return;
      }

      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;

      for (let idx = 0; idx < oldCatalog.length; idx += 1) {
        const entry = oldCatalog[idx];
        const fields = entry?.fields || {};

        const itemName = String(
          fields.stockItem?.mapValue?.fields?.itemName?.stringValue || 'AuraHut Co'
        ).trim();
        const scentName = String(
          fields.scentInfo?.mapValue?.fields?.scentName?.stringValue || 'Signature'
        ).trim();

        const combinedName = scentName.toLowerCase().includes(itemName.toLowerCase())
          ? scentName
          : `${itemName} ${scentName}`.trim();

        const cleanName = (combinedName || 'Arabian Fragrance').slice(0, 140);
        const cleanBrand = (itemName || 'AuraHut Co.').slice(0, 100);
        const rawId =
          typeof entry?.name === 'string' ? entry.name.split('/').pop() || '' : '';
        const slugBase = `${cleanBrand}-${cleanName}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 140);
        const slug = slugBase || `perfume-${idx + 1}`;
        const docId = (rawId ? `stock-${rawId}` : slug)
          .replace(/[^a-zA-Z0-9_-]/g, '-')
          .slice(0, 120);

        const rawImage = String(
          fields.scentInfo?.mapValue?.fields?.scentPhoto?.stringValue || ''
        ).trim();
        const image =
          rawImage.length > 0 && rawImage.length <= 500
            ? rawImage
            : '/assets/images/house_lattafa_1794685069142.jpg';

        const pricingFields = fields.stockPricing?.mapValue?.fields || {};
        const onHandFields = fields.onHand?.mapValue?.fields || {};
        const stockQty = readNum(onHandFields.stockQty, 0);
        const inStock = stockQty > 0;
        const category = normalizeCategory(
          fields.stockCategory?.stringValue || '',
          cleanName
        );
        const scentSize = fields.scentInfo?.mapValue?.fields?.scentSize?.integerValue || '100';

        const basePayload = {
          slug,
          isSampleListing: false,
          name: cleanName,
          brand: cleanBrand,
          category,
          concentration: 'Eau de Parfum',
          description: `${cleanName} by ${cleanBrand}. Authentic Arabian fragrance available at AuraHut Co.`.slice(
            0,
            2000
          ),
          image,
          notes: {
            top: ['Arabian spices', 'Citrus notes'],
            heart: ['Floral accords', 'Oud nuances'],
            base: ['Amber', 'Musk', 'Vanilla'],
          },
          sizes: buildSizes(pricingFields, scentSize, inStock),
          availability: inStock ? 'In Stock' : 'Out of Stock',
          featured: false,
          bestseller: false,
          onSpecial: Boolean(fields.stockPromo?.booleanValue),
          specialLabel: fields.stockPromo?.booleanValue ? 'Special' : '',
          specialDiscountPercent: 0,
        };

        try {
          const docRef = doc(db, 'perfumes', docId);
          const existingSnap = await getDoc(docRef);
          if (existingSnap.exists()) {
            await updateDoc(docRef, {
              ...basePayload,
              updatedAt: serverTimestamp(),
            });
            updatedCount += 1;
          } else {
            await setDoc(docRef, {
              ...basePayload,
              ownerUid: currentUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            createdCount += 1;
          }
        } catch (err) {
          failedCount += 1;
          console.error(`Failed to migrate ${cleanName}:`, err);
        }

        if ((idx + 1) % 10 === 0 || idx === oldCatalog.length - 1) {
          setStatusMessage(
            `Processed ${idx + 1} / ${oldCatalog.length} (Created: ${createdCount}, Updated: ${updatedCount}, Failed: ${failedCount})`
          );
        }
      }

      setStatusMessage(
        `Migration finished. Created ${createdCount}, updated ${updatedCount}${
          failedCount > 0 ? `, failed ${failedCount}` : ''
        }.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to complete catalog migration.'
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-[#0A0A0A] text-white border-b border-white/15 px-4 py-3 text-center">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3">
        {!confirming ? (
          <button
            type="button"
            disabled={running}
            onClick={() => {
              setErrorMessage('');
              setConfirming(true);
            }}
            className="px-4 py-2 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] disabled:opacity-50 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            {running ? 'Migrating Catalog...' : 'Run Catalog Migration to Firestore'}
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-white/85">
              Import &amp; sync entries from old_catalog.json into Firestore?
            </span>
            <button
              type="button"
              onClick={runMigration}
              className="px-3.5 py-1.5 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] text-xs font-bold uppercase tracking-wider"
            >
              Confirm Migration
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3.5 py-1.5 rounded-full border border-white/30 text-white hover:border-white text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {statusMessage && (
          <p className="text-xs text-[#FACC15] font-medium">{statusMessage}</p>
        )}
        {errorMessage && (
          <p className="text-xs text-[#FCA5A5] font-medium">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}