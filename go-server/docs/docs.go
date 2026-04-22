// Package docs는 swaggo/swag에 의해 자동 생성된 API 문서 데이터가 포함된 패키지입니다.
// 이 파일은 직접 수정하지 마십시오.
package docs

import "github.com/swaggo/swag"

const docTemplate = `{
    "schemes": {{ marshal .Schemes }},
    "swagger": "2.0",
    "info": {
        "description": "{{escape .Description}}",
        "title": "{{.Title}}",
        "contact": {},
        "version": "{{.Version}}"
    },
    "host": "{{.Host}}",
    "basePath": "{{.BasePath}}",
    "paths": {
        "/admin/audit-logs": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Audit Logs"
                ],
                "summary": "감사 로그 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/audit-logs/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Audit Logs"
                ],
                "summary": "감사 로그 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "감사 로그 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/brands": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Brands"
                ],
                "summary": "브랜드 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Brands"
                ],
                "summary": "브랜드 생성",
                "parameters": [
                    {
                        "description": "브랜드 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Brand"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/brands/{code}": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Brands"
                ],
                "summary": "브랜드 삭제",
                "parameters": [
                    {
                        "type": "string",
                        "description": "브랜드 코드",
                        "name": "code",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Brands"
                ],
                "summary": "브랜드 수정",
                "parameters": [
                    {
                        "type": "string",
                        "description": "브랜드 코드",
                        "name": "code",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "브랜드 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Brand"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/carts": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Carts"
                ],
                "summary": "전체 장바구니 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/carts/user/{userId}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Carts"
                ],
                "summary": "회원 장바구니 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "userId",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/carts/user/{userId}/all": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Carts"
                ],
                "summary": "회원 장바구니 전체 비우기",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "userId",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/carts/{id}": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Carts"
                ],
                "summary": "장바구니 항목 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "장바구니 항목 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/events": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Events"
                ],
                "summary": "이벤트 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Events"
                ],
                "summary": "이벤트 생성",
                "parameters": [
                    {
                        "description": "이벤트 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Event"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/events/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Events"
                ],
                "summary": "이벤트 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "이벤트 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Events"
                ],
                "summary": "이벤트 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "이벤트 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Events"
                ],
                "summary": "이벤트 수정",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "이벤트 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "이벤트 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Event"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/faqs": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - FAQs"
                ],
                "summary": "FAQ 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - FAQs"
                ],
                "summary": "FAQ 생성",
                "parameters": [
                    {
                        "description": "FAQ 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Faq"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/faqs/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - FAQs"
                ],
                "summary": "FAQ 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "FAQ ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - FAQs"
                ],
                "summary": "FAQ 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "FAQ ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - FAQs"
                ],
                "summary": "FAQ 수정",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "FAQ ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "FAQ 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Faq"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/gifts": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Gifts"
                ],
                "summary": "선물 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/gifts/stats": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Gifts"
                ],
                "summary": "선물 통계 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/gifts/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Gifts"
                ],
                "summary": "선물 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "선물 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/inquiries": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Inquiries"
                ],
                "summary": "문의 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/inquiries/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Inquiries"
                ],
                "summary": "문의 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "문의 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Inquiries"
                ],
                "summary": "문의 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "문의 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/inquiries/{id}/answer": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Inquiries"
                ],
                "summary": "문의 답변 등록",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "문의 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "답변 내용",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/inquiries/{id}/close": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Inquiries"
                ],
                "summary": "문의 종료 처리",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "문의 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/notices": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Notices"
                ],
                "summary": "공지사항 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Notices"
                ],
                "summary": "공지사항 생성",
                "parameters": [
                    {
                        "description": "공지사항 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Notice"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/notices/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Notices"
                ],
                "summary": "공지사항 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "공지사항 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Notices"
                ],
                "summary": "공지사항 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "공지사항 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Notices"
                ],
                "summary": "공지사항 수정",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "공지사항 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "공지사항 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Notice"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/orders": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Orders"
                ],
                "summary": "주문 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "상태 필터",
                        "name": "status",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/orders/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Orders"
                ],
                "summary": "주문 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "주문 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/orders/{id}/status": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Orders"
                ],
                "summary": "주문 상태 변경",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "주문 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "주문 상태",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/products": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Products"
                ],
                "summary": "상품 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Products"
                ],
                "summary": "상품 생성",
                "parameters": [
                    {
                        "description": "상품 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Product"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/products/{id}": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Products"
                ],
                "summary": "상품 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "상품 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Products"
                ],
                "summary": "상품 수정",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "상품 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "상품 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.Product"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/refunds": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Refunds"
                ],
                "summary": "환불 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/refunds/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Refunds"
                ],
                "summary": "환불 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "환불 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/refunds/{id}/approve": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Refunds"
                ],
                "summary": "환불 승인",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "환불 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/refunds/{id}/reject": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Refunds"
                ],
                "summary": "환불 거부",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "환불 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/reports/bank-transactions": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Reports"
                ],
                "summary": "은행 거래 내역 리포트 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/reports/trade-in-payouts": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Reports"
                ],
                "summary": "매입 지급 리포트 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/reports/user-transactions/{userId}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Reports"
                ],
                "summary": "회원 거래 내역 내보내기",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "userId",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/sessions": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Sessions"
                ],
                "summary": "세션 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/sessions/user/{userId}": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Sessions"
                ],
                "summary": "회원 세션 전체 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "userId",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/sessions/{id}": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Sessions"
                ],
                "summary": "세션 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "세션 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/site-configs": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Site Config"
                ],
                "summary": "사이트 설정 목록 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Site Config"
                ],
                "summary": "사이트 설정 생성",
                "parameters": [
                    {
                        "description": "설정 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.CreateSiteConfigRequest"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/site-configs/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Site Config"
                ],
                "summary": "사이트 설정 단건 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "설정 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Site Config"
                ],
                "summary": "사이트 설정 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "설정 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/site-configs/{key}": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Site Config"
                ],
                "summary": "사이트 설정 수정",
                "parameters": [
                    {
                        "type": "string",
                        "description": "설정 키",
                        "name": "key",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "변경할 값",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.UpdateSiteConfigRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/stats": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "대시보드 통계 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/trade-ins": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Trade-Ins"
                ],
                "summary": "매입 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "상태 필터",
                        "name": "status",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/trade-ins/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Trade-Ins"
                ],
                "summary": "매입 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "매입 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/trade-ins/{id}/status": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Trade-Ins"
                ],
                "summary": "매입 상태 변경",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "매입 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "상태 및 관리자 메모",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/users": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "회원 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "KYC 상태 필터",
                        "name": "kycStatus",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "역할 필터",
                        "name": "role",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "회원 생성",
                "parameters": [
                    {
                        "description": "회원 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.User"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/users/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "회원 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "회원 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "회원 정보 수정",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "회원 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.User"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/users/{id}/kyc": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "회원 KYC 상태 변경",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "KYC 상태",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/users/{id}/password": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "회원 비밀번호 초기화",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "새 비밀번호",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/users/{id}/role": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Users"
                ],
                "summary": "회원 역할 변경",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "회원 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "역할 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/vouchers": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Vouchers"
                ],
                "summary": "바우처 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "상태 필터",
                        "name": "status",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "description": "상품 ID 필터",
                        "name": "productId",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/vouchers/bulk": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Vouchers"
                ],
                "summary": "바우처 일괄 업로드",
                "parameters": [
                    {
                        "description": "바우처 목록",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/seedream-gift-server_internal_domain.VoucherCode"
                            }
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/vouchers/inventory": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Vouchers"
                ],
                "summary": "바우처 재고 현황 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/vouchers/stock/{productId}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Vouchers"
                ],
                "summary": "상품별 바우처 재고 수량 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "상품 ID",
                        "name": "productId",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/admin/vouchers/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Vouchers"
                ],
                "summary": "바우처 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "바우처 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Vouchers"
                ],
                "summary": "바우처 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "바우처 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Admin - Vouchers"
                ],
                "summary": "바우처 수정",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "바우처 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "수정할 필드",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/forgot-password": {
            "post": {
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "비밀번호 재설정 토큰 발급",
                "parameters": [
                    {
                        "description": "이메일 주소",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/login": {
            "post": {
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "로그인",
                "parameters": [
                    {
                        "description": "로그인 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.LoginRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "401": {
                        "description": "Unauthorized",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/login/mfa": {
            "post": {
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "MFA 2단계 로그인",
                "parameters": [
                    {
                        "description": "MFA 토큰 및 TOTP 코드",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "401": {
                        "description": "Unauthorized",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/logout": {
            "post": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "로그아웃",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/me": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "내 정보 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/mfa/disable": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "MFA"
                ],
                "summary": "MFA 비활성화",
                "parameters": [
                    {
                        "description": "현재 TOTP 코드",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/mfa/setup": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "MFA"
                ],
                "summary": "MFA 설정 (QR 코드 생성)",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/mfa/status": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "MFA"
                ],
                "summary": "MFA 활성화 상태 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/mfa/verify": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "MFA"
                ],
                "summary": "MFA 활성화 (TOTP 코드 검증)",
                "parameters": [
                    {
                        "description": "TOTP 코드",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/password": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "비밀번호 변경",
                "parameters": [
                    {
                        "description": "기존/새 비밀번호",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/profile": {
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "프로필 수정",
                "parameters": [
                    {
                        "description": "수정할 프로필 필드 (key-value)",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "409": {
                        "description": "Conflict",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/refresh": {
            "post": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "토큰 갱신 (쿠키 기반)",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "401": {
                        "description": "Unauthorized",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/register": {
            "post": {
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "회원가입",
                "parameters": [
                    {
                        "description": "회원가입 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_domain.User"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "409": {
                        "description": "Conflict",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/reset-password": {
            "post": {
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "비밀번호 재설정",
                "parameters": [
                    {
                        "description": "이메일, 재설정 토큰, 새 비밀번호",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/sessions": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "활성 세션 목록 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "다른 모든 세션 삭제",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/auth/sessions/{id}": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Auth"
                ],
                "summary": "특정 세션 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "세션 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/brands": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Brands"
                ],
                "summary": "브랜드 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지당 항목 수",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/brands/{code}": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Brands"
                ],
                "summary": "브랜드 단건 조회",
                "parameters": [
                    {
                        "type": "string",
                        "description": "브랜드 코드",
                        "name": "code",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/cart": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Cart"
                ],
                "summary": "장바구니 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Cart"
                ],
                "summary": "장바구니에 상품 추가",
                "parameters": [
                    {
                        "description": "추가할 상품 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.CartAddItemRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Cart"
                ],
                "summary": "장바구니 전체 비우기",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/cart/batch": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Cart"
                ],
                "summary": "장바구니 상품 일괄 삭제",
                "parameters": [
                    {
                        "description": "삭제할 상품 ID 목록",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.CartBatchRemoveRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/cart/check-limit": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Cart"
                ],
                "summary": "장바구니 구매 한도 확인",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/cart/{id}": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Cart"
                ],
                "summary": "장바구니 상품 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "장바구니 항목 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Cart"
                ],
                "summary": "장바구니 상품 수량 변경",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "장바구니 항목 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "변경할 수량",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.CartUpdateQuantityRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/events": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Events"
                ],
                "summary": "이벤트 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지당 항목 수",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/events/active": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Events"
                ],
                "summary": "활성 이벤트 목록 조회",
                "parameters": [
                    {
                        "type": "string",
                        "description": "이벤트 상태 필터",
                        "name": "status",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/events/featured": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Events"
                ],
                "summary": "추천 이벤트 목록 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/events/{id}": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Events"
                ],
                "summary": "이벤트 단건 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "이벤트 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/events/{id}/view": {
            "patch": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Events"
                ],
                "summary": "이벤트 조회수 증가",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "이벤트 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/faqs": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "FAQs"
                ],
                "summary": "FAQ 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지당 항목 수",
                        "name": "limit",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "카테고리 필터",
                        "name": "category",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/faqs/active": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "FAQs"
                ],
                "summary": "활성 FAQ 목록 조회",
                "parameters": [
                    {
                        "type": "string",
                        "description": "카테고리 필터",
                        "name": "category",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/faqs/categories": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "FAQs"
                ],
                "summary": "FAQ 카테고리 목록 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/faqs/{id}": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "FAQs"
                ],
                "summary": "FAQ 단건 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "FAQ ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/faqs/{id}/helpful": {
            "patch": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "FAQs"
                ],
                "summary": "FAQ 도움됨 수 증가",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "FAQ ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/gifts/check-receiver": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Gifts"
                ],
                "summary": "선물 수신자 확인",
                "parameters": [
                    {
                        "description": "수신자 이메일",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.CheckReceiverRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/gifts/received": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Gifts"
                ],
                "summary": "받은 선물 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/gifts/search": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Gifts"
                ],
                "summary": "선물 수신자 검색",
                "parameters": [
                    {
                        "type": "string",
                        "description": "이름 또는 이메일 검색어 (최소 3자)",
                        "name": "query",
                        "in": "query",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/gifts/{id}/claim": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Gifts"
                ],
                "summary": "선물 수령",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "선물 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/health": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Health"
                ],
                "summary": "서버 상태 확인",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "503": {
                        "description": "Service Unavailable",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/inquiries": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Inquiries"
                ],
                "summary": "내 문의 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지당 항목 수",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "401": {
                        "description": "Unauthorized",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Inquiries"
                ],
                "summary": "문의 등록",
                "parameters": [
                    {
                        "description": "문의 내용 (category, subject, content 필수)",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "401": {
                        "description": "Unauthorized",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/inquiries/{id}": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Inquiries"
                ],
                "summary": "문의 삭제",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "문의 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "401": {
                        "description": "Unauthorized",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "patch": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Inquiries"
                ],
                "summary": "문의 수정",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "문의 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    },
                    {
                        "description": "수정할 문의 내용",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "401": {
                        "description": "Unauthorized",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/kyc/bank-account": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "KYC"
                ],
                "summary": "등록된 계좌 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            },
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "KYC"
                ],
                "summary": "계좌 변경",
                "parameters": [
                    {
                        "description": "인증 거래번호 및 인증어",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/kyc/bank-verify/confirm": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "KYC"
                ],
                "summary": "1원 인증 확인",
                "parameters": [
                    {
                        "description": "인증 확인 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_app_services.BankVerifyConfirmRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/kyc/bank-verify/request": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "KYC"
                ],
                "summary": "1원 인증 요청",
                "parameters": [
                    {
                        "description": "은행 계좌 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_app_services.BankVerifyRequest"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/kyc/kcb/check-status": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "KCB"
                ],
                "summary": "KCB 인증 상태 조회",
                "parameters": [
                    {
                        "type": "string",
                        "description": "KCB 인증 ID",
                        "name": "kcbAuthId",
                        "in": "query",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/kyc/kcb/complete": {
            "post": {
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "KCB"
                ],
                "summary": "KCB 본인인증 완료",
                "parameters": [
                    {
                        "description": "KCB 인증 결과 데이터",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/kyc/kcb/start": {
            "post": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "KCB"
                ],
                "summary": "KCB 본인인증 세션 시작",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/kyc/verify-sms": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "KYC"
                ],
                "summary": "SMS 본인인증 처리",
                "parameters": [
                    {
                        "description": "휴대폰 번호",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/notices": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Notices"
                ],
                "summary": "공지사항 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지당 항목 수",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/notices/active": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Notices"
                ],
                "summary": "활성 공지사항 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 5,
                        "description": "조회 개수",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/notices/{id}": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Notices"
                ],
                "summary": "공지사항 단건 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "공지사항 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/notices/{id}/view": {
            "patch": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Notices"
                ],
                "summary": "공지사항 조회수 증가",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "공지사항 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/orders": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Orders"
                ],
                "summary": "주문 생성",
                "parameters": [
                    {
                        "description": "주문 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_app_services.CreateOrderInput"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/orders/my": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Orders"
                ],
                "summary": "내 주문 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 10,
                        "description": "페이지당 항목 수",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/orders/my-gifts": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Gifts"
                ],
                "summary": "받은 선물 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지 크기",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/orders/my/bank-submission": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Orders"
                ],
                "summary": "내 계좌 제출 내역 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/orders/my/export": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Orders"
                ],
                "summary": "내 주문 내보내기",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/orders/payment/confirm": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Orders"
                ],
                "summary": "결제 확인 및 주문 처리",
                "parameters": [
                    {
                        "description": "결제 확인 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.PaymentConfirmRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/orders/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Orders"
                ],
                "summary": "주문 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "주문 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/orders/{id}/cancel": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Orders"
                ],
                "summary": "주문 취소",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "주문 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/payments/initiate": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Payments"
                ],
                "summary": "결제 시작",
                "parameters": [
                    {
                        "description": "결제 요청 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_app_services.PaymentInitiateRequest"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/payments/verify": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Payments"
                ],
                "summary": "결제 검증",
                "parameters": [
                    {
                        "type": "string",
                        "description": "결제 키",
                        "name": "paymentKey",
                        "in": "query",
                        "required": true
                    },
                    {
                        "type": "integer",
                        "description": "주문 ID",
                        "name": "orderId",
                        "in": "query",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/products": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Products"
                ],
                "summary": "상품 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지 번호",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 20,
                        "description": "페이지당 항목 수",
                        "name": "limit",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "브랜드 필터",
                        "name": "brand",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/products/brand/{brand}": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Products"
                ],
                "summary": "브랜드별 상품 목록 조회",
                "parameters": [
                    {
                        "type": "string",
                        "description": "브랜드 코드",
                        "name": "brand",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/products/live-rates": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Products"
                ],
                "summary": "실시간 상품 할인율 조회",
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/products/{id}": {
            "get": {
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Products"
                ],
                "summary": "상품 단건 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "상품 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/trade-ins": {
            "post": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Trade-Ins"
                ],
                "summary": "매입 신청",
                "parameters": [
                    {
                        "description": "매입 신청 정보",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/seedream-gift-server_internal_app_services.CreateTradeInInput"
                        }
                    }
                ],
                "responses": {
                    "201": {
                        "description": "Created",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/trade-ins/my": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Trade-Ins"
                ],
                "summary": "내 매입 신청 목록 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "default": 1,
                        "description": "페이지",
                        "name": "page",
                        "in": "query"
                    },
                    {
                        "type": "integer",
                        "default": 10,
                        "description": "페이지당 항목 수",
                        "name": "limit",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/trade-ins/{id}": {
            "get": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Trade-Ins"
                ],
                "summary": "매입 신청 상세 조회",
                "parameters": [
                    {
                        "type": "integer",
                        "description": "매입 신청 ID",
                        "name": "id",
                        "in": "path",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "404": {
                        "description": "Not Found",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        },
        "/users/me": {
            "delete": {
                "security": [
                    {
                        "BearerAuth": []
                    }
                ],
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Users"
                ],
                "summary": "회원 탈퇴",
                "parameters": [
                    {
                        "description": "비밀번호 확인",
                        "name": "body",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "type": "object"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "$ref": "#/definitions/internal_api_handlers.APIResponse"
                        }
                    }
                }
            }
        }
    },
    "definitions": {
        "internal_api_handlers.APIResponse": {
            "type": "object",
            "properties": {
                "data": {},
                "error": {
                    "type": "string"
                },
                "errorId": {
                    "type": "string"
                },
                "message": {
                    "type": "string"
                },
                "success": {
                    "type": "boolean"
                }
            }
        },
        "internal_api_handlers.CartAddItemRequest": {
            "type": "object",
            "required": [
                "productId",
                "quantity"
            ],
            "properties": {
                "productId": {
                    "type": "integer"
                },
                "quantity": {
                    "type": "integer",
                    "minimum": 1
                }
            }
        },
        "internal_api_handlers.CartBatchRemoveRequest": {
            "type": "object",
            "required": [
                "productIds"
            ],
            "properties": {
                "productIds": {
                    "type": "array",
                    "items": {
                        "type": "integer"
                    }
                }
            }
        },
        "internal_api_handlers.CartUpdateQuantityRequest": {
            "type": "object",
            "required": [
                "quantity"
            ],
            "properties": {
                "quantity": {
                    "type": "integer",
                    "minimum": 1
                }
            }
        },
        "internal_api_handlers.CheckReceiverRequest": {
            "type": "object",
            "required": [
                "email"
            ],
            "properties": {
                "email": {
                    "type": "string",
                    "example": "user@example.com"
                }
            }
        },
        "internal_api_handlers.CreateSiteConfigRequest": {
            "type": "object",
            "required": [
                "key",
                "type",
                "value"
            ],
            "properties": {
                "description": {
                    "type": "string",
                    "example": "일일 최대 구매 한도 (원)"
                },
                "key": {
                    "type": "string",
                    "example": "PURCHASE_LIMIT_DAILY"
                },
                "type": {
                    "type": "string",
                    "example": "NUMBER"
                },
                "value": {
                    "type": "string",
                    "example": "1000000"
                }
            }
        },
        "internal_api_handlers.LoginRequest": {
            "type": "object",
            "required": [
                "email",
                "password"
            ],
            "properties": {
                "email": {
                    "type": "string"
                },
                "password": {
                    "type": "string"
                }
            }
        },
        "internal_api_handlers.PaymentConfirmRequest": {
            "type": "object",
            "required": [
                "orderId",
                "paymentKey"
            ],
            "properties": {
                "orderId": {
                    "type": "integer"
                },
                "paymentKey": {
                    "type": "string"
                }
            }
        },
        "internal_api_handlers.UpdateSiteConfigRequest": {
            "type": "object",
            "required": [
                "value"
            ],
            "properties": {
                "value": {
                    "type": "string",
                    "example": "2000000"
                }
            }
        },
        "seedream-gift-server_internal_app_services.BankVerifyConfirmRequest": {
            "type": "object",
            "required": [
                "accountNumber",
                "bankCode",
                "verifyTrDt",
                "verifyTrNo",
                "verifyVal"
            ],
            "properties": {
                "accountNumber": {
                    "type": "string"
                },
                "bankCode": {
                    "type": "string"
                },
                "verifyTrDt": {
                    "type": "string"
                },
                "verifyTrNo": {
                    "type": "string"
                },
                "verifyVal": {
                    "description": "The 3-digit code",
                    "type": "string"
                }
            }
        },
        "seedream-gift-server_internal_app_services.BankVerifyRequest": {
            "type": "object",
            "required": [
                "accountHolder",
                "accountNumber",
                "bankCode",
                "bankName"
            ],
            "properties": {
                "accountHolder": {
                    "type": "string"
                },
                "accountNumber": {
                    "type": "string"
                },
                "bankCode": {
                    "type": "string"
                },
                "bankName": {
                    "type": "string"
                }
            }
        },
        "seedream-gift-server_internal_app_services.CreateOrderInput": {
            "type": "object",
            "required": [
                "items"
            ],
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": [
                            "productId",
                            "quantity"
                        ],
                        "properties": {
                            "productId": {
                                "type": "integer"
                            },
                            "quantity": {
                                "type": "integer",
                                "minimum": 1
                            }
                        }
                    }
                },
                "paymentMethod": {
                    "type": "string"
                },
                "recipientAddr": {
                    "type": "string"
                },
                "recipientName": {
                    "type": "string"
                },
                "recipientPhone": {
                    "type": "string"
                },
                "recipientZip": {
                    "type": "string"
                },
                "shippingMethod": {
                    "type": "string"
                }
            }
        },
        "seedream-gift-server_internal_app_services.CreateTradeInInput": {
            "type": "object",
            "required": [
                "accountHolder",
                "accountNum",
                "bankName",
                "pinCode",
                "productId",
                "quantity"
            ],
            "properties": {
                "accountHolder": {
                    "type": "string"
                },
                "accountNum": {
                    "type": "string"
                },
                "bankName": {
                    "type": "string"
                },
                "giftNumber": {
                    "type": "string"
                },
                "pinCode": {
                    "type": "string"
                },
                "productId": {
                    "type": "integer"
                },
                "quantity": {
                    "type": "integer",
                    "minimum": 1
                },
                "securityCode": {
                    "type": "string"
                }
            }
        },
        "seedream-gift-server_internal_app_services.PaymentInitiateRequest": {
            "type": "object",
            "required": [
                "amount",
                "method",
                "orderId"
            ],
            "properties": {
                "amount": {
                    "type": "number"
                },
                "method": {
                    "type": "string"
                },
                "orderId": {
                    "type": "integer"
                }
            }
        },
        "seedream-gift-server_internal_domain.Brand": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string"
                },
                "color": {
                    "type": "string"
                },
                "createdAt": {
                    "type": "string"
                },
                "description": {
                    "type": "string"
                },
                "imageUrl": {
                    "type": "string"
                },
                "isActive": {
                    "type": "boolean"
                },
                "name": {
                    "type": "string"
                },
                "order": {
                    "type": "integer"
                },
                "pinConfig": {
                    "type": "string"
                },
                "updatedAt": {
                    "type": "string"
                }
            }
        },
        "seedream-gift-server_internal_domain.Event": {
            "type": "object",
            "properties": {
                "createdAt": {
                    "type": "string"
                },
                "description": {
                    "type": "string"
                },
                "endDate": {
                    "type": "string"
                },
                "id": {
                    "type": "integer"
                },
                "imageUrl": {
                    "type": "string"
                },
                "isActive": {
                    "type": "boolean"
                },
                "isFeatured": {
                    "type": "boolean"
                },
                "startDate": {
                    "type": "string"
                },
                "title": {
                    "type": "string"
                },
                "updatedAt": {
                    "type": "string"
                },
                "viewCount": {
                    "type": "integer"
                }
            }
        },
        "seedream-gift-server_internal_domain.Faq": {
            "type": "object",
            "properties": {
                "answer": {
                    "type": "string"
                },
                "category": {
                    "type": "string"
                },
                "createdAt": {
                    "type": "string"
                },
                "helpfulCount": {
                    "type": "integer"
                },
                "id": {
                    "type": "integer"
                },
                "isActive": {
                    "type": "boolean"
                },
                "order": {
                    "type": "integer"
                },
                "question": {
                    "type": "string"
                },
                "updatedAt": {
                    "type": "string"
                }
            }
        },
        "seedream-gift-server_internal_domain.Notice": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string"
                },
                "createdAt": {
                    "type": "string"
                },
                "id": {
                    "type": "integer"
                },
                "isActive": {
                    "type": "boolean"
                },
                "title": {
                    "type": "string"
                },
                "updatedAt": {
                    "type": "string"
                },
                "viewCount": {
                    "type": "integer"
                }
            }
        },
        "seedream-gift-server_internal_domain.NumericDecimal": {
            "type": "object",
            "properties": {
                "decimal.Decimal": {
                    "type": "number"
                }
            }
        },
        "seedream-gift-server_internal_domain.Product": {
            "type": "object",
            "properties": {
                "allowTradeIn": {
                    "type": "boolean"
                },
                "brand": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.Brand"
                },
                "brandCode": {
                    "type": "string"
                },
                "buyPrice": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.NumericDecimal"
                },
                "createdAt": {
                    "type": "string"
                },
                "description": {
                    "type": "string"
                },
                "discountRate": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.NumericDecimal"
                },
                "id": {
                    "type": "integer"
                },
                "imageUrl": {
                    "type": "string"
                },
                "isActive": {
                    "type": "boolean"
                },
                "name": {
                    "type": "string"
                },
                "price": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.NumericDecimal"
                },
                "shippingMethod": {
                    "type": "string"
                },
                "tradeInRate": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.NumericDecimal"
                },
                "type": {
                    "type": "string"
                },
                "updatedAt": {
                    "type": "string"
                }
            }
        },
        "seedream-gift-server_internal_domain.User": {
            "type": "object",
            "properties": {
                "accountHolder": {
                    "type": "string"
                },
                "accountNumber": {
                    "type": "string"
                },
                "address": {
                    "type": "string"
                },
                "addressDetail": {
                    "type": "string"
                },
                "bankCode": {
                    "type": "string"
                },
                "bankName": {
                    "type": "string"
                },
                "bankVerifiedAt": {
                    "type": "string"
                },
                "canReceiveGift": {
                    "type": "boolean"
                },
                "createdAt": {
                    "type": "string"
                },
                "customLimitPerDay": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.NumericDecimal"
                },
                "customLimitPerTx": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.NumericDecimal"
                },
                "email": {
                    "type": "string"
                },
                "emailNotification": {
                    "type": "boolean"
                },
                "failedLoginAttempts": {
                    "type": "integer"
                },
                "id": {
                    "type": "integer"
                },
                "kycData": {
                    "type": "string"
                },
                "kycStatus": {
                    "type": "string"
                },
                "lastLoginAt": {
                    "type": "string"
                },
                "lockedUntil": {
                    "type": "string"
                },
                "mfaEnabled": {
                    "type": "boolean"
                },
                "name": {
                    "type": "string"
                },
                "partnerSince": {
                    "type": "string"
                },
                "partnerTier": {
                    "type": "string"
                },
                "phone": {
                    "type": "string"
                },
                "pushNotification": {
                    "type": "boolean"
                },
                "role": {
                    "type": "string"
                },
                "totalTradeInVolume": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.NumericDecimal"
                },
                "updatedAt": {
                    "type": "string"
                },
                "verifyAttemptCount": {
                    "type": "integer"
                },
                "zipCode": {
                    "type": "string"
                }
            }
        },
        "seedream-gift-server_internal_domain.VoucherCode": {
            "type": "object",
            "properties": {
                "createdAt": {
                    "type": "string"
                },
                "expiredAt": {
                    "type": "string"
                },
                "giftNumber": {
                    "type": "string"
                },
                "id": {
                    "type": "integer"
                },
                "orderId": {
                    "type": "integer"
                },
                "pinCode": {
                    "type": "string"
                },
                "pinHash": {
                    "type": "string"
                },
                "product": {
                    "$ref": "#/definitions/seedream-gift-server_internal_domain.Product"
                },
                "productId": {
                    "type": "integer"
                },
                "securityCode": {
                    "type": "string"
                },
                "soldAt": {
                    "type": "string"
                },
                "status": {
                    "type": "string"
                },
                "updatedAt": {
                    "type": "string"
                },
                "usedAt": {
                    "type": "string"
                }
            }
        }
    },
    "securityDefinitions": {
        "BearerAuth": {
            "description": "Bearer {access_token}",
            "type": "apiKey",
            "name": "Authorization",
            "in": "header"
        }
    }
}`

// SwaggerInfo holds exported Swagger Info so clients can modify it
var SwaggerInfo = &swag.Spec{
	Version:          "1.0",
	Host:             "localhost:5140",
	BasePath:         "/api/v1",
	Schemes:          []string{},
	Title:            "씨드림기프트 API",
	Description:      "백화점 상품권 판매 및 매입 플랫폼 API",
	InfoInstanceName: "swagger",
	SwaggerTemplate:  docTemplate,
	LeftDelim:        "{{",
	RightDelim:       "}}",
}

func init() {
	swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}
