# THE ZOOS · 포트폴리오 데모

[웹사이트 열기](https://nas123nas.github.io/the_zoos_mapping_dummy/)

가상의 반려동물 상품 58개를 사용하는 주문 매핑·재고·입고 관리 포트폴리오입니다. 모든 내장 업무 데이터는 더미데이터입니다.

GitHub Pages가 `main` 브랜치의 루트 폴더를 자동 배포합니다. `.nojekyll`로 정적 HTML/CSS/JavaScript를 그대로 제공합니다.

## 로컬 실행

```sh
python -m http.server 8765
```

## 데이터 및 필터 검증

```sh
node tests/portfolio-data.test.cjs
node tests/soldout-categories.test.cjs
```

품절리스트에서 카테고리를 선택하지 않으면 전체 품절 대상을 표시합니다. ‘카테고리 초기화’로 분류와 의류 시즌을 해제할 수 있습니다.

[더미데이터 및 시연 안내](./README-포트폴리오.md)
