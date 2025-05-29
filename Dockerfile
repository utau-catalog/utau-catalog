# ベースイメージはNode.js 18の公式イメージ
FROM node:18

# 作業ディレクトリを/appに設定
WORKDIR /app

# package.json と package-lock.jsonをコピー（依存関係インストール用）
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# 残りのアプリケーションコードをコピー
COPY . .

# Bot起動コマンド
CMD ["npm", "start"]
