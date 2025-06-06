#!/bin/bash

# 環境変数をJavaScriptファイルに注入
sed -i "s|__SUPABASE_URL__|${VITE_SUPABASE_URL}|g" js/env-config.js
sed -i "s|__SUPABASE_ANON_KEY__|${VITE_SUPABASE_ANON_KEY}|g" js/env-config.js
