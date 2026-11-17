import React from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Make sure this points to your firebase config file
import oldCatalog from './old_catalog.json';

export default function MigrateDataButton() {
  const runMigration = async () => {
    if (!window.confirm(`Are you sure you want to migrate ${oldCatalog.length} perfumes?`)) return;

    console.log("Starting migration...");

    for (const doc of oldCatalog) {
      const fields = doc.fields || {};

      const itemName = fields.stockItem?.mapValue?.fields?.itemName?.stringValue || 'AuraHut Co';
      const scentName = fields.scentInfo?.mapValue?.fields?.scentName?.stringValue || 'Signature';
      const name = scentName.toLowerCase().includes(itemName.toLowerCase()) 
        ? scentName 
        : `${itemName} ${scentName}`.trim();
      
      const brand = itemName;
      const image = fields.scentInfo?.mapValue?.fields?.scentPhoto?.stringValue || '';
      const retailPrice = Number(fields.stockPricing?.mapValue?.fields?.retailPrice?.integerValue || 650);
      const stockQty = Number(fields.onHand?.mapValue?.fields?.stockQty?.doubleValue || fields.onHand?.mapValue?.fields?.stockQty?.integerValue || 0);
      const category = fields.stockCategory?.stringValue || 'Unisex';
      const scentSize = fields.scentInfo?.mapValue?.fields?.scentSize?.integerValue || "100";

      const newProduct = {
        name: name,
        brand: brand,
        slug: `${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        category: category,
        concentration: "Eau de Parfum",
        availability: stockQty > 0 ? "In Stock" : "Out of Stock",
        bestseller: false,
        featured: false,
        isSampleListing: false,
        onSpecial: fields.stockPromo?.booleanValue || false,
        specialDiscountPercent: 0,
        specialLabel: "",
        description: `${name} by ${brand}. Premium Arabian fragrance available at AuraHut Co.`,
        image: image,
        ownerUid: fields.createdBy?.mapValue?.fields?.userID?.stringValue || "CEeKK6c7L5Vvgwi6TT9WaH2TGHF2",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: {
          top: ["Arabian spices", "Citrus notes"],
          heart: ["Floral accords", "Oud nuances"],
          base: ["Amber", "Musk", "Vanilla"]
        },
        sizes: [
          { size: "5ml", available: false, price: null },
          { size: "10ml", available: false, price: null },
          { size: "22ml", available: false, price: null },
          { size: `${scentSize}ml`, available: stockQty > 0, price: retailPrice }
        ]
      };

      try {
        await addDoc(collection(db, "perfumes"), newProduct);
        console.log(`Migrated: ${name}`);
      } catch (error) {
        console.error(`Failed to migrate ${name}:`, error);
      }
    }

    alert("Migration complete! Check your Firestore database.");
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <button 
        onClick={runMigration} 
        style={{ padding: '12px 24px', background: 'black', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}
      >
        Run Catalog Migration to Firestore
      </button>
    </div>
  );
}