import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import {
  Container,
  Typography,
  Box,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Modal,
  IconButton,
  createTheme,
  ThemeProvider,
} from "@mui/material";
import L from "leaflet";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { db, storage } from "./firebase"; // Firebase yapılandırması
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore"; // Firestore işlemleri
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"; // Storage işlemleri
import { query, where } from "firebase/firestore"; // Firestore işlemleri
import markerIcon from "./asset/marker.png";

const redIcon = new L.Icon({
  iconUrl: markerIcon,
  iconSize: [25, 25],
  iconAnchor: [12, 25],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Tema oluşturma
const theme = createTheme({
  typography: {
    fontFamily: `'Cormorant Garamond', serif`,
    fontSize: 16,
    fontWeightRegular: 500,
    h4: {
      fontWeight: 600,
    },
    body1: {
      fontSize: "1.3rem",
    },
    body2: {
      fontSize: "1rem",
    },
    body3: {
      fontSize: "0.7rem",
    },
  },
});

const App = () => {
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedNoteText, setSelectedNoteText] = useState("");
  const [selectedNoteDate, setSelectedNoteDate] = useState("");
  const [selectedNote, setSelectedNote] = useState(null); // Düzenlenecek notu saklamak için state
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Auth durumu için state
  const [username, setUsername] = useState(""); // Kullanıcı adı için state
  const [password, setPassword] = useState(""); // Şifre için state
  const [authError, setAuthError] = useState(""); // Hata mesajı için state
  // Firestore'dan verileri almak için
  const fetchNotes = async () => {
    const notesCollection = collection(db, "notes"); // Firestore'daki 'notes' koleksiyonu
    const notesSnapshot = await getDocs(notesCollection);
    const notesList = notesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setNotes(notesList);
    setFilteredNotes(notesList);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Filtreleme işlevi
  useEffect(() => {
    filterNotes();
  }, [notes, searchTerm, startDate, endDate]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [filteredNotes]);
  // Uygulama yüklendiğinde localStorage'daki durumu kontrol et
  useEffect(() => {
    const isUserLoggedIn = localStorage.getItem("isAuthenticated");
    if (isUserLoggedIn === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Giriş yap fonksiyonu
  const handleLogin = async () => {
    const usersCollection = collection(db, "users");
    const q = query(
      usersCollection,
      where("username", "==", username),
      where("password", "==", password)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      setIsAuthenticated(true); // Giriş başarılıysa auth durumunu true yap
      localStorage.setItem("isAuthenticated", "true"); // Giriş durumunu localStorage'a kaydet
    } else {
      setAuthError("Kullanıcı adı veya şifre hatalı"); // Giriş hatalıysa hata mesajı göster
    }
  };

  // Edit modalını açmak için fonksiyon
  const handleEditClick = (note) => {
    setSelectedNote(note); // Düzenlemek için notu seçiyoruz
    setOpenModal(true); // Edit modalını açıyoruz
  };

  // handleEditNote fonksiyonu güncellemesi
  const handleEditNote = async (
    noteId,
    updatedNoteText,
    updatedNoteDate,
    updatedImageFile
  ) => {
    // selectedNote'un image değerini kontrol ediyoruz
    let updatedImageUrl = selectedNote?.image || null; // Eğer yeni bir resim yüklenmediyse mevcut resmi koruyalım

    if (updatedImageFile) {
      const storageRef = ref(
        storage,
        `images/${Date.now()}_${updatedImageFile.name}`
      );
      await uploadBytes(storageRef, updatedImageFile);
      updatedImageUrl = await getDownloadURL(storageRef);
    }

    const noteDoc = doc(db, "notes", noteId); // Firestore'da belirli notun dokümanını bul
    await updateDoc(noteDoc, {
      noteText: updatedNoteText,
      date: updatedNoteDate,
      image: updatedImageUrl,
    })
      .then(() => {
        console.log("Not başarıyla güncellendi.");
        fetchNotes(); // Notları yeniden çek
        setOpenModal(false); // Modalı kapat
      })
      .catch((error) => {
        console.error("Not güncellenirken bir hata oluştu:", error);
      });
  };

  const filterNotes = () => {
    const filtered = notes.filter((note) => {
      const matchesNote = note.noteText
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const noteDate = new Date(note.date);
      const matchesDate =
        (!startDate || noteDate >= new Date(startDate)) &&
        (!endDate || noteDate <= new Date(endDate));
      return matchesNote && matchesDate;
    });
    setFilteredNotes(filtered);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setFilteredNotes(notes);
  };

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    setCurrentPosition({ lat, lng });
    setOpenModal(true);
  };

  const addNote = async (noteText, date, imageFile) => {
    let imageUrl = null;

    // Firebase Storage'a resim yükleme
    if (imageFile) {
      const storageRef = ref(storage, `images/${Date.now()}_${imageFile.name}`);
      await uploadBytes(storageRef, imageFile); // Dosyayı Firebase Storage'a yükleme
      imageUrl = await getDownloadURL(storageRef); // Yüklenen dosyanın URL'sini alma
    }

    const newNote = {
      position: { lat: currentPosition.lat, lng: currentPosition.lng },
      noteText,
      date,
      image: imageUrl,
    };

    // Firestore'a not ekleme
    const docRef = await addDoc(collection(db, "notes"), newNote);
    setNotes([...notes, { ...newNote, id: docRef.id }]);
    setFilteredNotes([...notes, { ...newNote, id: docRef.id }]);
    setCurrentPosition(null);
    setOpenModal(false);
  };

  const handleDeleteNote = async (id) => {
    await deleteDoc(doc(db, "notes", id)); // Firestore'dan sil
    const updatedNotes = notes.filter((note) => note.id !== id);
    setNotes(updatedNotes);
    setFilteredNotes(updatedNotes);
  };

  const handleImageClick = (image, date, noteText) => {
    setSelectedImage(image);
    setSelectedNoteText(noteText);
    setSelectedNoteDate(date);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const focusOnMarker = (index) => {
    if (mapRef.current && markerRefs.current[index]) {
      mapRef.current.flyTo(markerRefs.current[index].getLatLng(), 4);
      markerRefs.current[index].openPopup();
    }
  };

  if (!isAuthenticated) {
    // Eğer kullanıcı giriş yapmadıysa login ekranını göster
    return (
      <ThemeProvider theme={theme}>
        <Container>
          <Typography variant="h4" align="center" gutterBottom>
            GeoNote
          </Typography>
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            sx={{ mt: 4 }}
          >
            <Typography variant="h5" gutterBottom>
              Giriş Yap
            </Typography>
            <TextField
              label="Kullanıcı Adı"
              variant="outlined"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{ mb: 2, width: "100%", maxWidth: "400px" }}
            />
            <TextField
              label="Şifre"
              variant="outlined"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2, width: "100%", maxWidth: "400px" }}
            />
            {authError && (
              <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                {authError}
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={handleLogin}
              sx={{
                backgroundColor: "#6F4E37",
                color: "#fff",
                borderRadius: "12px",
                "&:hover": {
                  backgroundColor: "#5a3c2c",
                },
                width: "100%",
                maxWidth: "400px",
              }}
            >
              Giriş Yap
            </Button>
          </Box>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Container>
        {/* Harita Not Uygulaması Başlığı */}
        <Typography variant="h4" align="center" gutterBottom>
          GeoNote
        </Typography>

        {/* Harita Alanı */}
        <Box mb={4} borderRadius={2} overflow="hidden" boxShadow={3}>
          <MapContainer
            center={[20, 0]}
            zoom={2}
            minZoom={2}
            style={{ height: "625px", width: "100%" }}
            maxBounds={[
              [-85, -180],
              [85, 180],
            ]}
            maxBoundsViscosity={1.0}
            worldCopyJump={false}
            ref={mapRef}
          >
            <TileLayer
              url="https://api.maptiler.com/maps/landscape/{z}/{x}/{y}.png?key=omtCYLs4sz10d556MSai"
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> contributors'
            />
            <MapClickHandler onClick={handleMapClick} />

            {filteredNotes.length > 0 ? (
              filteredNotes.map((note, index) => (
                <Marker
                  key={index}
                  position={note.position}
                  icon={redIcon}
                  ref={(el) => (markerRefs.current[index] = el)}
                >
                  <Popup>
                    <Box
                      display="flex"
                      flexDirection="row"
                      alignItems="center"
                      justifyContent="flex-start"
                    >
                      {note.image && (
                        <Box mr={2}>
                          <img
                            src={note.image}
                            alt="note"
                            width="60"
                            style={{ borderRadius: "4px", cursor: "pointer" }} // cursor: "pointer" ile tıklanabilirlik belirtildi
                            onClick={() =>
                              handleImageClick(
                                note.image,
                                note.date,
                                note.noteText
                              )
                            } // Resme tıklandığında handleImageClick çağrılır
                          />
                        </Box>
                      )}
                      <Box
                        display="flex"
                        flexDirection="column"
                        justifyContent="center"
                      >
                        <Typography variant="caption" sx={{ color: "brown" }}>
                          {new Date(note.date).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                          {note.noteText}
                        </Typography>
                      </Box>
                    </Box>
                  </Popup>
                </Marker>
              ))
            ) : (
              <Typography variant="body2">Not eklenmedi.</Typography>
            )}
          </MapContainer>
        </Box>

        {/* Filtreler ve Notlar Tablosu */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Typography variant="h5" gutterBottom>
            Filtre
          </Typography>
          <Button
            variant="contained"
            onClick={resetFilters}
            sx={{
              backgroundColor: "#6F4E37",
              color: "#fff",
              borderRadius: "12px",
              "&:hover": {
                backgroundColor: "#5a3c2c",
              },
            }}
          >
            FİLTRELERİ TEMİZLE
          </Button>
        </Box>

        <TextField
          label="Not Ara"
          variant="outlined"
          fullWidth
          margin="normal"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          multiline
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "12px",
            },
          }}
        />

        <Box display="flex" gap={2} mb={4}>
          <TextField
            label="Başlangıç Tarihi"
            type="date"
            fullWidth
            margin="normal"
            slotProps={{
              inputLabel: { shrink: true },
            }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
              },
            }}
          />
          <TextField
            label="Bitiş Tarihi"
            type="date"
            fullWidth
            margin="normal"
            slotProps={{
              inputLabel: { shrink: true },
            }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
              },
            }}
          />
        </Box>

        <Typography variant="h5" gutterBottom>
          Notlar
        </Typography>
        <NoteTable
          notes={filteredNotes}
          onDelete={handleDeleteNote}
          onEdit={handleEditClick}
          onFocusMarker={focusOnMarker}
        />

        <NoteModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          onSubmit={addNote}
        />

        {selectedImage && (
          <Modal
            open={true}
            onClose={closeImageModal}
            aria-labelledby="image-modal-title"
          >
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "80%",
                maxHeight: "80%",
                bgcolor: "background.paper",
                boxShadow: 24,
                p: 4,
                borderRadius: 2,
              }}
            >
              <img
                src={selectedImage}
                alt="note"
                style={{
                  width: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  bgcolor: "rgba(0, 0, 0, 0.7)",
                  color: "white",
                  p: 1,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">
                  Tarih: {selectedNoteDate}
                </Typography>
                <Typography variant="body2">Not: {selectedNoteText}</Typography>
              </Box>
            </Box>
          </Modal>
        )}
        {/* Düzenleme Modalı */}
        {selectedNote && (
          <EditNoteModal
            open={openModal}
            onClose={() => setOpenModal(false)}
            note={selectedNote}
            onSubmit={handleEditNote}
          />
        )}
      </Container>
    </ThemeProvider>
  );
};

const MapClickHandler = ({ onClick }) => {
  useMapEvents({
    click: onClick,
  });
  return null;
};

const NoteModal = ({ open, onClose, onSubmit }) => {
  const [noteText, setNoteText] = useState("");
  const [date, setDate] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const handleImageChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(noteText, date, imageFile);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400,
          bgcolor: "#f9f9f9",
          boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.12)",
          p: 4,
          borderRadius: "24px",
          overflow: "hidden",
        }}
      >
        <Typography
          id="modal-title"
          variant="h6"
          component="h2"
          gutterBottom
          sx={{ fontWeight: "bold", color: "#333" }}
        >
          Yeni Not Ekle
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Not Girin"
            fullWidth
            margin="normal"
            multiline
            minRows={3}
            onChange={(e) => setNoteText(e.target.value)}
            required
            sx={{
              borderRadius: "12px",
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
              },
            }}
          />
          <TextField
            label="Tarih"
            type="date"
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setDate(e.target.value)}
            required
            sx={{
              borderRadius: "12px",
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
              },
            }}
          />
          <TextField
            type="file"
            fullWidth
            margin="normal"
            onChange={handleImageChange}
            accept="image/*"
            InputProps={{
              inputProps: {
                style: {
                  fontSize: "0.9rem",
                  padding: "10px",
                },
              },
            }}
            sx={{
              borderRadius: "12px",
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              mt: 2,
              backgroundColor: "#6F4E37",
              color: "#fff",
              borderRadius: "20px",
              "&:hover": {
                backgroundColor: "#5a3c2c",
              },
            }}
          >
            Not Ekle
          </Button>
        </form>
      </Box>
    </Modal>
  );
};

const NoteTable = ({ notes, onDelete, onEdit, onFocusMarker }) => (
  <TableContainer
    component={Paper}
    sx={{ mt: 4, mb: 8, borderRadius: 2, boxShadow: 3 }}
  >
    <Table>
      <TableHead>
        <TableRow>
          <TableCell
            sx={{
              fontSize: "1rem",
              fontWeight: "bold",
              color: "#333",
              width: "5%",
            }}
          ></TableCell>
          <TableCell
            sx={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              color: "#333",
              width: "75%",
            }}
          >
            Not
          </TableCell>
          <TableCell
            sx={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              color: "#333",
              width: "10%",
            }}
          >
            Tarih
          </TableCell>
          <TableCell
            sx={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              color: "#333",
              width: "10%",
            }}
          >
            İşlemler
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {notes.map((note, index) => (
          <TableRow
            key={index}
            hover
            sx={{
              "&:last-child td, &:last-child th": { border: 0 },
              backgroundColor: "#f9f9f9",
              borderBottom: "1px solid #ddd",
            }}
          >
            {/* Map Icon Kolonu */}
            <TableCell
              sx={{ fontSize: "0.7rem", fontWeight: "bold", color: "#333" }}
            >
              <IconButton color="default" onClick={() => onFocusMarker(index)}>
                <LocationOnIcon sx={{ color: "#6F4E37" }} />
              </IconButton>
            </TableCell>
            {/* Not Kolonu */}
            <TableCell
              sx={{
                fontSize: "0.975rem",
                fontWeight: "regular",
                color: "#333",
              }}
            >
              {note.noteText}
            </TableCell>
            {/* Tarih Kolonu */}
            <TableCell
              sx={{ fontSize: "1.1rem", fontWeight: "bold", color: "#333" }}
            >
              {new Date(note.date).toLocaleDateString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </TableCell>
            {/* İşlemler Kolonu */}
            <TableCell
              sx={{ display: "flex", gap: 1, justifyContent: "center" }}
            >
              <IconButton
                color="primary"
                onClick={() => onEdit(note)}
                sx={{ "&:hover": { backgroundColor: "#e0f7fa" } }}
              >
                <EditIcon />
              </IconButton>
              <IconButton
                color="secondary"
                onClick={() => onDelete(note.id)}
                sx={{ "&:hover": { backgroundColor: "#ffebee" } }}
              >
                <DeleteIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

// EditNoteModal bileşeni
const EditNoteModal = ({ open, onClose, note, onSubmit }) => {
  // Eğer note propsu undefined veya null ise varsayılan boş değerler kullanıyoruz
  const [noteText, setNoteText] = useState(note?.noteText || "");
  const [date, setDate] = useState(note?.date || "");
  const [imageFile, setImageFile] = useState(null);

  const handleImageChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(note.id, noteText, date, imageFile);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 400,
          bgcolor: "#f9f9f9",
          boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.12)",
          p: 4,
          borderRadius: "24px",
          overflow: "hidden",
        }}
      >
        <Typography variant="h6" component="h2" gutterBottom>
          Notu Düzenle
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Not"
            fullWidth
            margin="normal"
            multiline
            minRows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            required
          />
          <TextField
            label="Tarih"
            type="date"
            fullWidth
            margin="normal"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <TextField
            type="file"
            fullWidth
            margin="normal"
            onChange={handleImageChange}
            accept="image/*"
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
            Güncelle
          </Button>
        </form>
      </Box>
    </Modal>
  );
};

export default App;
