package main

import (
	"log"
	"net/http"

	"github.com/type-fight/server/internal/api"
	"github.com/type-fight/server/internal/game"
	"github.com/type-fight/server/internal/ws"
)

func main() {
	roomManager := game.NewRoomManager()
	hub := ws.NewHub()
	go hub.Run()

	handler := ws.NewHandler(hub, roomManager)
	routes := api.NewRoutes(roomManager, hub, handler)

	mux := http.NewServeMux()
	routes.Setup(mux)

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
