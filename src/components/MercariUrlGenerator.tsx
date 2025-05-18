// src/components/MercariUrlGenerator.tsx

import React, { useState, useEffect } from 'react';
import styles from '../styles/MercariUrlGenerator.module.css';

// 商品状態の型定義
interface ConditionOption {
  id: string;
  label: string;
}

// 販売状態の型定義
interface StatusOption {
  value: string;
  label: string;
}

const MercariUrlGenerator: React.FC = () => {
  // 状態管理
  const [keyword, setKeyword] = useState<string>('嵐 CD');
  const [excludeKeyword, setExcludeKeyword] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  // 商品状態オプション
  const conditionOptions: ConditionOption[] = [
    { id: '1', label: '新品、未使用' },
    { id: '2', label: '未使用に近い' },
    { id: '3', label: '目立った傷や汚れなし' },
    { id: '4', label: 'やや傷や汚れあり' },
    { id: '5', label: '傷や汚れあり' },
    { id: '6', label: '全体的に状態が悪い' }
  ];
  
  // 販売状態オプション
  const statusOptions: StatusOption[] = [
    { value: '', label: 'すべて' },
    { value: 'on_sale', label: '販売中のみ' },
    { value: 'sold_out', label: '売り切れのみ' }
  ];
  
  // URL生成関数
  const generateUrl = (): string => {
    // ベースURL
    let url = 'https://jp.mercari.com/search?';
    
    // キーワード追加
    if (keyword) {
      url += `keyword=${encodeURIComponent(keyword)}`;
    }
    
    // 除外キーワード追加
    if (excludeKeyword) {
      url += `&exclude_keyword=${encodeURIComponent(excludeKeyword)}`;
    }
    
    // 販売状態追加
    if (selectedStatus) {
      url += `&status=${selectedStatus}`;
    }
    
    // 商品状態追加
    if (selectedConditions.length > 0) {
      url += `&item_condition_id=${selectedConditions.join('%2C')}`;
    }
    
    return url;
  };
  
  // URL生成を実行するトリガー
  useEffect(() => {
    setGeneratedUrl(generateUrl());
  }, [keyword, excludeKeyword, selectedStatus, selectedConditions]);
  
  // 商品状態の選択を処理
  const handleConditionChange = (conditionId: string): void => {
    setSelectedConditions(prev => {
      if (prev.includes(conditionId)) {
        return prev.filter(id => id !== conditionId);
      } else {
        return [...prev, conditionId];
      }
    });
  };
  
  // URLをクリップボードにコピー
  const copyToClipboard = (): void => {
    navigator.clipboard.writeText(generatedUrl)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('クリップボードへのコピーに失敗しました', err);
      });
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>メルカリ検索URL生成ツール</h1>
      
      {/* 検索キーワード */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          検索キーワード
        </label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className={styles.input}
          placeholder="例: 嵐 CD"
        />
      </div>
      
      {/* 除外キーワード */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          除外キーワード
        </label>
        <input
          type="text"
          value={excludeKeyword}
          onChange={(e) => setExcludeKeyword(e.target.value)}
          className={styles.input}
          placeholder="例: DVD 写真集"
        />
      </div>
      
      {/* 販売状態 */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          販売状態
        </label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className={styles.select}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      {/* 商品状態 */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          商品の状態
        </label>
        <div className={styles.checkboxGroup}>
          {conditionOptions.map(condition => (
            <div key={condition.id} className={styles.checkboxItem}>
              <input
                type="checkbox"
                id={`condition-${condition.id}`}
                checked={selectedConditions.includes(condition.id)}
                onChange={() => handleConditionChange(condition.id)}
                className={styles.checkbox}
              />
              <label htmlFor={`condition-${condition.id}`} className={styles.checkboxLabel}>
                {condition.label}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      {/* 生成されたURL */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          生成されたURL
        </label>
        <div className={styles.urlContainer}>
          <input
            type="text"
            value={generatedUrl}
            readOnly
            className={styles.urlInput}
          />
          <button
            onClick={copyToClipboard}
            className={styles.copyBtn}
            title="クリップボードにコピー"
          >
            📋
          </button>
        </div>
        {copySuccess && (
          <p className={styles.successMessage}>URLをコピーしました！</p>
        )}
      </div>
      
      {/* メルカリで開くボタン */}
      <div className={styles.actionContainer}>
        <a
          href={generatedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.searchBtn}
        >
          メルカリで検索する
        </a>
      </div>
    </div>
  );
};

export default MercariUrlGenerator;
