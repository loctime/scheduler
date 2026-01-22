import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MessageSquare, X } from "lucide-react"
import { useCellComment } from "@/hooks/use-cell-comment"
import { useData } from "@/contexts/data-context"

interface CommentIconProps {
  ownerId: string
  employeeId: string
  date: string
  className?: string
}

export function CommentIcon({ ownerId, employeeId, date, className }: CommentIconProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [commentText, setCommentText] = useState("")
  const { user } = useData()
  
  const { comment, loading, error, saveComment, deleteComment } = useCellComment(ownerId, employeeId, date)

  const handleOpenDialog = () => {
    setCommentText(comment || "")
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!user) return
    
    try {
      await saveComment(commentText, user.uid)
      setDialogOpen(false)
    } catch (error) {
      console.error("Error saving comment:", error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteComment()
      setDialogOpen(false)
    } catch (error) {
      console.error("Error deleting comment:", error)
    }
  }

  const hasComment = !!comment

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`h-5 w-5 transition-all ${
          hasComment 
            ? "bg-primary text-primary-foreground opacity-100" 
            : "bg-muted/50 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-primary hover:text-primary-foreground"
        } ${className}`}
        onClick={handleOpenDialog}
        title={hasComment ? "Ver comentario" : "Agregar comentario"}
      >
        <MessageSquare className="h-3 w-3" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comentario</DialogTitle>
            <DialogDescription>
              Agrega un comentario para esta celda (ej: enfermedad, viaje, vacaciones)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Ej: Enfermedad / Viaje / Vacaciones"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSave()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            {hasComment && (
              <Button variant="destructive" onClick={handleDelete}>
                <X className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
