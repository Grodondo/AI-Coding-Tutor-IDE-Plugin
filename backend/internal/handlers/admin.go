package handlers

import (
	"net/http"
	"strconv"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/logger"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// UserResponse represents the user data returned to admin
type UserResponse struct {
	ID        int    `json:"id"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
	LastLogin string `json:"lastLogin,omitempty"`
}

// GetAllUsersHandler returns all users for admin management
func GetAllUsersHandler(dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		logger.Log.Info("GetAllUsersHandler: Fetching all users")

		users, err := dbService.GetAllUsers()
		if err != nil {
			logger.Log.Errorf("GetAllUsersHandler: Failed to fetch users: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}

		// Convert to response format
		var userResponses []UserResponse
		for _, user := range users {
			var lastLoginStr string
			// Check if last login is the default zero time (indicating NULL in DB)
			if !user.LastLogin.IsZero() && user.LastLogin.Year() > 1970 {
				lastLoginStr = user.LastLogin.Format("2006-01-02T15:04:05Z07:00")
			}

			userResponses = append(userResponses, UserResponse{
				ID:        user.ID,
				FirstName: user.FirstName,
				LastName:  user.LastName,
				Email:     user.Email,
				Username:  user.Username,
				Role:      user.Role,
				CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
				LastLogin: lastLoginStr,
			})
		}

		logger.Log.Infof("GetAllUsersHandler: Returning %d users", len(userResponses))
		c.JSON(http.StatusOK, userResponses)
	}
}

// UpdateUserRoleHandler updates a user's role
func UpdateUserRoleHandler(dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("id")
		userID, err := strconv.Atoi(userIDStr)
		if err != nil {
			logger.Log.Errorf("UpdateUserRoleHandler: Invalid user ID: %s", userIDStr)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}

		var request struct {
			Role string `json:"role" binding:"required"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			logger.Log.Errorf("UpdateUserRoleHandler: Invalid request body: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		// Validate role
		if request.Role != "admin" && request.Role != "user" && request.Role != "superadmin" {
			logger.Log.Errorf("UpdateUserRoleHandler: Invalid role: %s", request.Role)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be 'admin', 'user', or 'superadmin'"})
			return
		}

		// Get current user details from context
		currentUsername, exists := c.Get("username")
		if !exists {
			logger.Log.Error("UpdateUserRoleHandler: Username not found in context")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		currentRole, exists := c.Get("role")
		if !exists {
			logger.Log.Error("UpdateUserRoleHandler: Role not found in context")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Check if the current user can update this role
		err = dbService.CanUpdateUserRole(currentRole.(string), currentUsername.(string), userID, request.Role)
		if err != nil {
			logger.Log.Warnf("UpdateUserRoleHandler: Role update not allowed: %v", err)
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}

		logger.Log.Infof("UpdateUserRoleHandler: Updating user %d role to %s", userID, request.Role)

		err = dbService.UpdateUserRole(userID, request.Role)
		if err != nil {
			logger.Log.Errorf("UpdateUserRoleHandler: Failed to update user role: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
			return
		}

		logger.Log.Infof("UpdateUserRoleHandler: Successfully updated user %d role to %s", userID, request.Role)
		c.JSON(http.StatusOK, gin.H{"message": "User role updated successfully"})
	}
}

// DeleteUserHandler deletes a user
func DeleteUserHandler(dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.Param("id")
		userID, err := strconv.Atoi(userIDStr)
		if err != nil {
			logger.Log.Errorf("DeleteUserHandler: Invalid user ID: %s", userIDStr)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}
		// Get current user from context (set by auth middleware)
		currentUsername, exists := c.Get("username")
		if !exists {
			logger.Log.Error("DeleteUserHandler: Username not found in context")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Get current user role from context
		currentRole, exists := c.Get("role")
		if !exists {
			logger.Log.Error("DeleteUserHandler: Role not found in context")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Only superadmin can delete users
		if currentRole.(string) != "superadmin" {
			logger.Log.Warnf("DeleteUserHandler: Non-superadmin user %s trying to delete user", currentUsername.(string))
			c.JSON(http.StatusForbidden, gin.H{"error": "Only superadmin can delete users"})
			return
		}

		// Prevent admin from deleting themselves
		currentUser, err := dbService.GetUserProfile(currentUsername.(string))
		if err != nil {
			logger.Log.Errorf("DeleteUserHandler: Failed to get current user: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify current user"})
			return
		}

		if currentUser.ID == userID {
			logger.Log.Warn("DeleteUserHandler: Admin trying to delete themselves")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
			return
		}

		logger.Log.Infof("DeleteUserHandler: Deleting user %d", userID)

		err = dbService.DeleteUser(userID)
		if err != nil {
			logger.Log.Errorf("DeleteUserHandler: Failed to delete user: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
			return
		}

		logger.Log.Infof("DeleteUserHandler: Successfully deleted user %d", userID)
		c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
	}
}
