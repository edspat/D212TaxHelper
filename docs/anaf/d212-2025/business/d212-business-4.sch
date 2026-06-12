<pattern xmlns="http://purl.oclc.org/dsdl/schematron" id="business-4">
  <!-- versiunea v1.0.2 din 21.04.2026 s-au modificat regula  BR-D212-0094: IF categ_venit NOT IN (1003,1012,1021,1022,1023,1024, 1025,1026) THEN descriere_sediu_bun MUST EXISTS
        si regula BR-D212-0102: IF ((categ_venit IN (1016,1003,1009,1010,1011) AND forma_org=1) OR categ_venit IN (1015,1006,1026))THEN venit_brut MUST EXISTS ELSE venit_brut MUST NOT EXISTS --> 
  <!-- versiunea v1.0.1 din 13.01.2026 s-a modificat regula  BR-D212-0112: IF (NOT( categ_venit IN (1016,1003) AND det_ven_net = 1 ))THEN (IF pierdere EXISTS THEN impozit11 MUST EXISTS AND impozit11 = 0)--> 
  <!-- versiunea v1.0.0 din 23.12.2025 conform cu d212_documentatieTehnica_v1.0.0_23122025.xls --> 
  <!-- Conține reguli: 
       BR-D212-0079 … BR-D212-0114  +  BR-D212-0085 
  -->
  <title>D212 – Business validation</title>
  
  
  <rule context="d212:cap11">
    <!-- ====================================================== -->
    <!-- BR-D212-0079: IF cap11 EXISTS && nerezident == 1, THEN scutire MUST EXISTS ELSE scutire MUST NOT EXISTS.                         -->
    <!-- ====================================================== --> 
    <!-- descrieri -->
    <let name="desc_nerez_0079"
      value="$schema//xs:attribute[@name='nerezident']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_scutire_0079"
      value="$schema//xs:attribute[@name='scutire']/xs:annotation/xs:documentation[1]"/>
    
    <!-- valori -->
    <let name="nerez_0079" value="normalize-space(string(/*/@nerezident))"/>
    <let name="hasScutire_0079" value="exists(@scutire)"/>
    
    <!-- regula: nerezident=1 => scutire exista; altfel scutire nu exista -->
    <let name="isValid_0079"
      value="($nerez_0079 = '1' and $hasScutire_0079)
      or
      ($nerez_0079 != '1' and not($hasScutire_0079))"/>
    
    <assert test="$isValid_0079" flag="fatal" id="BR-D212-0079">
      [BR-D212-0079]
      Atributul
      <value-of select="if (normalize-space($desc_scutire_0079)!='') then $desc_scutire_0079 else 'scutire'"/>
      (scutire)
      din elementul <value-of select="name(.)"/>
      trebuie corelat cu atributul
      <value-of select="if (normalize-space($desc_nerez_0079)!='') then $desc_nerez_0079 else 'nerezident'"/>
      (nerezident) de pe radacina astfel:
      daca nerezident = 1, atunci scutire trebuie sa existe; altfel scutire nu trebuie sa existe.
    </assert>
    

    <!-- ====================================================== -->
    <!-- BR-D212-0080: IF categ_venit != (1012, 1021, 1022, 1023, 1024) THEN scutire != 1                        -->
    <!-- ====================================================== --> 
      <let name="desc_categ_0080"
        value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_scutire_0080"
        value="$schema//xs:attribute[@name='scutire']/xs:annotation/xs:documentation[1]"/>
      
      <let name="categ_0080" value="normalize-space(string(@categ_venit))"/>
      <let name="scutire_0080" value="normalize-space(string(@scutire))"/>
      
    <let name="isAllowedCateg_0080" value="$categ_0080 = '1012' or $categ_0080 = '1021' or $categ_0080 = '1022' or $categ_0080 = '1023'  or $categ_0080 = '1024'"/>
      
      <!-- daca nu e permis, atunci scutire nu are voie sa fie 1 (poate lipsi sau poate fi 0/altceva) -->
      <let name="isValid_0080"
        value="$isAllowedCateg_0080 or not($scutire_0080 = '1')"/>
      
      <assert test="$isValid_0080" flag="fatal" id="BR-D212-0080">
        [BR-D212-0080]
        Atributul
        <value-of select="if (normalize-space($desc_scutire_0080)!='') then $desc_scutire_0080 else 'scutire'"/>
        (scutire)
        din elementul <value-of select="name(.)"/>
        nu poate avea valoarea 1 daca
        <value-of select="if (normalize-space($desc_categ_0080)!='') then $desc_categ_0080 else 'categ_venit'"/>
        (categ_venit) este diferit de 1012 sau 1025.
      </assert>
      

    <!-- ====================================================== -->
    <!-- BR-D212-0081: IF cap11 EXISTS && nerezident == 1, THEN reg MUST EXISTS ELSE reg MUST NOT EXISTS                        -->
    <!-- ====================================================== --> 
      <let name="desc_nerez_0081"
        value="$schema//xs:attribute[@name='nerezident']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_reg_0081"
        value="$schema//xs:attribute[@name='reg']/xs:annotation/xs:documentation[1]"/>
      
      <let name="nerez_0081" value="normalize-space(string(/*/@nerezident))"/>
      <let name="hasReg_0081" value="exists(@reg)"/>
      
      <let name="isValid_0081"
        value="($nerez_0081 = '1' and $hasReg_0081)
        or
        ($nerez_0081 != '1' and not($hasReg_0081))"/>
      
      <assert test="$isValid_0081" flag="fatal" id="BR-D212-0081">
        [BR-D212-0081]
        Atributul
        <value-of select="if (normalize-space($desc_reg_0081)!='') then $desc_reg_0081 else 'reg'"/>
        (reg)
        din elementul <value-of select="name(.)"/>
        trebuie corelat cu atributul
        <value-of select="if (normalize-space($desc_nerez_0081)!='') then $desc_nerez_0081 else 'nerezident'"/>
        (nerezident) de pe radacina astfel:
        daca nerezident = 1, atunci reg trebuie sa existe; altfel reg nu trebuie sa existe.
      </assert>
      
    <!-- ====================================================== -->
    <!-- BR-D212-0082: IF categ_venit != (1016, 1003) THEN reg != 1                        -->
    <!-- ====================================================== --> 
      
      <let name="desc_categ_0082"
        value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_reg_0082"
        value="$schema//xs:attribute[@name='reg']/xs:annotation/xs:documentation[1]"/>
      
      <let name="categ_0082" value="normalize-space(string(@categ_venit))"/>
      <let name="reg_0082" value="normalize-space(string(@reg))"/>
      
      <let name="isAllowedCateg_0082" value="$categ_0082 = '1016' or $categ_0082 = '1003'"/>
      
      <let name="isValid_0082"
        value="$isAllowedCateg_0082 or not($reg_0082 = '1')"/>
      
      <assert test="$isValid_0082" flag="fatal" id="BR-D212-0082">
        [BR-D212-0082]
        Atributul
        <value-of select="if (normalize-space($desc_reg_0082)!='') then $desc_reg_0082 else 'reg'"/>
        (reg)
        din elementul <value-of select="name(.)"/>
        nu poate avea valoarea 1 daca
        <value-of select="if (normalize-space($desc_categ_0082)!='') then $desc_categ_0082 else 'categ_venit'"/>
        (categ_venit) este diferit de 1016 sau 1003.
      </assert>

    <!-- ====================================================== -->
    <!-- BR-D212-0083: IF (scutire == 1) THEN reg = 0 mutual exclusiv  -->
    <!-- ====================================================== --> 
      <let name="desc_scutire_0083"
        value="$schema//xs:attribute[@name='scutire']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_reg_0083"
        value="$schema//xs:attribute[@name='reg']/xs:annotation/xs:documentation[1]"/>
      
      <let name="scutire_0083" value="normalize-space(string(@scutire))"/>
      <let name="reg_0083" value="normalize-space(string(@reg))"/>
      
      <let name="isValid_0083"
        value="not($scutire_0083 = '1' and $reg_0083 = '1')
        and
        (not($scutire_0083 = '1') or $reg_0083 = '0')"/>
      
      <assert test="$isValid_0083" flag="fatal" id="BR-D212-0083">
        [BR-D212-0083]
        Atributele
        <value-of select="if (normalize-space($desc_scutire_0083)!='') then $desc_scutire_0083 else 'scutire'"/>
        (scutire)
        si
        <value-of select="if (normalize-space($desc_reg_0083)!='') then $desc_reg_0083 else 'reg'"/>
        (reg)
        din elementul <value-of select="name(.)"/>
        sunt mutual exclusive:
        daca scutire = 1, atunci reg trebuie sa fie 0,
        iar scutire si reg nu pot avea in acelasi timp valoarea 1.
      </assert>
      
    <!-- ===================================================== -->
    <!-- BR-D212-0084: daca elementul cap11 exista => categ_venit trebuie sa existe -->
    <!-- Context: cap11 este repetitiv, regula se aplica pe fiecare aparitie -->
    <!-- ===================================================== -->

      
      <!-- descriere atribut categ_venit -->
      <let name="desc_categ_0084"
        value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
      
      <!-- exista atributul categ_venit? -->
      <let name="hasCateg_0084" value="exists(@categ_venit)"/>
      
      <assert test="$hasCateg_0084" flag="fatal" id="BR-D212-0084">
        [BR-D212-0084]
        Atributul
        <value-of select="if (normalize-space($desc_categ_0084)!='') then $desc_categ_0084 else 'categ_venit'"/>
        (categ_venit)
        din elementul <value-of select="name(.)"/>
        trebuie sa existe (este obligatoriu pentru fiecare aparitie a elementului cap11).
      </assert>
    
    <!-- ===================================================== -->
    <!-- BR-D212-0086: categ_venit in (1012,1021,1022,1023,1024,1025) => det_ven_net NU trebuie sa existe -->
    <!-- ===================================================== -->
    
    
    <let name="desc_categ_0086"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_det_0086"
      value="$schema//xs:attribute[@name='det_ven_net']/xs:annotation/xs:documentation[1]"/>
    
    <let name="categ_0086" value="normalize-space(@categ_venit)"/>
    <let name="hasDet_0086" value="exists(@det_ven_net)"/>
    
    <let name="isIn_0086"
      value="$categ_0086='1012' or $categ_0086='1021' or $categ_0086='1022' or $categ_0086='1023' or $categ_0086='1024' or $categ_0086='1025'"/>
    
    <let name="isValid_0086"
      value="not($isIn_0086) or (not($hasDet_0086))"/>
    
    <assert test="$isValid_0086" flag="fatal" id="BR-D212-0086">
      [BR-D212-0086]
      Daca atributul
      <value-of select="if (normalize-space($desc_categ_0086)!='') then $desc_categ_0086 else 'categ_venit'"/>
      (categ_venit)
      din elementul <value-of select="name(.)"/>
      are una dintre valorile (1012, 1021, 1022, 1023, 1024, 1025),
      atunci atributul
      <value-of select="if (normalize-space($desc_det_0086)!='') then $desc_det_0086 else 'det_ven_net'"/>
      (det_ven_net)
      nu trebuie sa fie prezent.
    </assert>
    
    
    
    <!-- ===================================================== -->
    <!-- BR-D212-0087: categ_venit in (1016,1006,1009,1010,1011) => det_ven_net = 1 (si trebuie sa existe) -->
    <!-- ===================================================== -->
    
    
    <let name="desc_categ_0087"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_det_0087"
      value="$schema//xs:attribute[@name='det_ven_net']/xs:annotation/xs:documentation[1]"/>
    
    <let name="categ_0087" value="normalize-space(@categ_venit)"/>
    <let name="det_0087" value="normalize-space(@det_ven_net)"/>
    <let name="hasDet_0087" value="exists(@det_ven_net)"/>
    
    <let name="isIn_0087"
      value="$categ_0087='1016' or $categ_0087='1006' or $categ_0087='1009' or $categ_0087='1010' or $categ_0087='1011'"/>
    
    <let name="isValid_0087"
      value="not($isIn_0087) or ($hasDet_0087 and $det_0087 = '1')"/>
    
    <assert test="$isValid_0087" flag="fatal" id="BR-D212-0087">
      [BR-D212-0087]
      Daca atributul
      <value-of select="if (normalize-space($desc_categ_0087)!='') then $desc_categ_0087 else 'categ_venit'"/>
      (categ_venit)
      din elementul <value-of select="name(.)"/>
      are una dintre valorile (1016, 1006, 1009, 1010, 1011),
      atunci atributul
      <value-of select="if (normalize-space($desc_det_0087)!='') then $desc_det_0087 else 'det_ven_net'"/>
      (det_ven_net)
      trebuie sa fie prezent si sa aiba valoarea 1.
    </assert>
    
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0088                                                         -->
    <!-- daca categ_venit = 1015 THEN det_ven_net = 2                          -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_0088"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_det_0088"
      value="$schema//xs:attribute[@name='det_ven_net']/xs:annotation/xs:documentation[1]"/>
    
    <let name="categ_0088" value="normalize-space(string(@categ_venit))"/>
    <let name="det_0088" value="normalize-space(string(@det_ven_net))"/>
    
    <let name="hasDet_0088"
      value="exists(@det_ven_net) and normalize-space(string(@det_ven_net)) != ''"/>
    
    <let name="isValid_0088"
      value="not($categ_0088 = '1015')
      or
      ($hasDet_0088 and ($det_0088 = '2'))"/>
    
    <assert test="$isValid_0088" flag="fatal" id="BR-D212-0088">
      [BR-D212-0088]
      Atributul
      <value-of select="if (normalize-space(string($desc_det_0088)) != '')
        then $desc_det_0088
        else 'det_ven_net'"/>
      din elementul <value-of select="name(.)"/>
      trebuie să existe și să aibă valoarea 2 atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_0088)) != '')
        then $desc_categ_0088
        else 'categ_venit'"/>
      are valoarea 1015.
    </assert>
    
    
    
    
    <!-- ===================================================== -->
    <!-- BR-D212-0089: daca categ_venit = 1003 => det_ven_net in (1,2) (si trebuie sa existe) -->
    <!-- ===================================================== -->
    
    
    <let name="desc_categ_0089"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_det_0089"
      value="$schema//xs:attribute[@name='det_ven_net']/xs:annotation/xs:documentation[1]"/>
    
    <let name="categ_0089" value="normalize-space(@categ_venit)"/>
    <let name="det_0089" value="normalize-space(@det_ven_net)"/>
    <let name="hasDet_0089" value="exists(@det_ven_net)"/>
    
    <let name="isValid_0089"
      value="not($categ_0089='1003') or ($hasDet_0089 and ($det_0089='1' or $det_0089='2'))"/>
    
    <assert test="$isValid_0089" flag="fatal" id="BR-D212-0089">
      [BR-D212-0089]
      Daca atributul
      <value-of select="if (normalize-space($desc_categ_0089)!='') then $desc_categ_0089 else 'categ_venit'"/>
      (categ_venit)
      din elementul <value-of select="name(.)"/>
      are valoarea 1003,
      atunci atributul
      <value-of select="if (normalize-space($desc_det_0089)!='') then $desc_det_0089 else 'det_ven_net'"/>
      (det_ven_net)
      trebuie sa fie prezent si sa aiba una dintre valorile: 1 sau 2.
    </assert>
    <!-- ===================================================================== -->
    <!-- BR-D212-0090: categ_venit IN (1006,1012,1015,1021,1022,1023,1024,1025)
                  => forma_org MUST NOT EXISTS
                  ELSE => forma_org MUST EXISTS -->
    <!-- Context: d212:cap11 -->
    <!-- ===================================================================== -->
    
      <!-- descrieri din XSD -->
      <let name="desc_categ_0090"
        value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_forma_0090"
        value="$schema//xs:attribute[@name='forma_org']/xs:annotation/xs:documentation[1]"/>
      
      <!-- valori -->
      <let name="categ_0090" value="normalize-space(@categ_venit)"/>
      <let name="hasForma_0090" value="exists(@forma_org)"/>
      
      <!-- lista pentru care forma_org NU trebuie sa existe -->
      <let name="isInList_0090"
        value="
        $categ_0090 = ('1006','1012','1015','1021','1022','1023','1024','1025')
        "/>
      
      <!-- validare -->
      <let name="isValid_0090"
        value="
        if ($isInList_0090)
        then not($hasForma_0090)
        else $hasForma_0090
        "/>
      
      <assert test="$isValid_0090" flag="fatal" id="BR-D212-0090">
        [BR-D212-0090]
        Daca atributul
        <value-of select="if (normalize-space($desc_categ_0090) != '') then $desc_categ_0090 else 'categ_venit'"/>
        (categ_venit)
        din elementul <value-of select="name(.)"/>
        are una dintre valorile (1006, 1012, 1015, 1021, 1022, 1023, 1024, 1025),
        atunci atributul
        <value-of select="if (normalize-space($desc_forma_0090) != '') then $desc_forma_0090 else 'forma_org'"/>
        (forma_org)
        NU trebuie sa fie prezent.
        In caz contrar (categ_venit in afara listei),
        atributul forma_org TREBUIE sa fie prezent.
      </assert>
      
    
    
    
    
    <!-- ===================================================================== -->
    <!-- BR-D212-0091: daca categ_venit IN (1012,1021,1022,1023,1024,1025) => forma_org != 3 (daca exista) -->
    <!-- ===================================================================== -->
    
    
    <let name="desc_categ_0091"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_forma_0091"
      value="$schema//xs:attribute[@name='forma_org']/xs:annotation/xs:documentation[1]"/>
    
    <let name="categ_0091" value="normalize-space(@categ_venit)"/>
    <let name="forma_0091" value="normalize-space(@forma_org)"/>
    <let name="hasForma_0091" value="exists(@forma_org)"/>
    
    <let name="isIn_0091"
      value="$categ_0091='1012' or $categ_0091='1021' or $categ_0091='1022' or $categ_0091='1023' or $categ_0091='1024' or $categ_0091='1025'"/>
    
    <let name="isValid_0091"
      value="not($isIn_0091) or (not($hasForma_0091) or $forma_0091 != '3')"/>
    
    <assert test="$isValid_0091" flag="fatal" id="BR-D212-0091">
      [BR-D212-0091]
      Daca atributul
      <value-of select="if (normalize-space($desc_categ_0091)!='') then $desc_categ_0091 else 'categ_venit'"/>
      (categ_venit)
      din elementul <value-of select="name(.)"/>
      este in lista (1012, 1021, 1022, 1023, 1024,1025),
      atunci atributul
      <value-of select="if (normalize-space($desc_forma_0091)!='') then $desc_forma_0091 else 'forma_org'"/>
      (forma_org)
      nu trebuie sa aiba valoarea 3 (Entităţi supuse regimului transparenţei fiscale).
    </assert>
    
    
    
    <!-- ===================================================================== -->
    <!-- BR-D212-0092: daca categ_venit != 1016 => forma_org != 4 (daca exista) -->
    <!-- ===================================================================== -->
    
    
    <let name="desc_categ_0092"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_forma_0092"
      value="$schema//xs:attribute[@name='forma_org']/xs:annotation/xs:documentation[1]"/>
    
    <let name="categ_0092" value="normalize-space(@categ_venit)"/>
    <let name="forma_0092" value="normalize-space(@forma_org)"/>
    <let name="hasForma_0092" value="exists(@forma_org)"/>
    
    <let name="isValid_0092"
      value="($categ_0092='1016') or (not($hasForma_0092) or $forma_0092 != '4')"/>
    
    <assert test="$isValid_0092" flag="fatal" id="BR-D212-0092">
      [BR-D212-0092]
      Daca atributul
      <value-of select="if (normalize-space($desc_categ_0092)!='') then $desc_categ_0092 else 'categ_venit'"/>
      (categ_venit)
      din elementul <value-of select="name(.)"/>
      NU are valoarea 1016,
      atunci atributul
      <value-of select="if (normalize-space($desc_forma_0092)!='') then $desc_forma_0092 else 'forma_org'"/>
      (forma_org)
      nu trebuie sa aiba valoarea 4 (Modificarea modalităţii/formei de exercitare a activităţii).
    </assert>
    
    <!-- ===================================================================== -->
    <!-- BR-D212-0093: categ_venit = 1016 <=> caen EXISTS -->
    <!-- ===================================================================== -->
    
    
    <!-- descrieri din XSD -->
    <let name="desc_categ_0093"
      value="$schema//xs:attribute[@name='categ_venit']
      /xs:annotation/xs:documentation[1]"/>
    
    <let name="desc_caen_0093"
      value="$schema//xs:attribute[@name='caen']
      /xs:annotation/xs:documentation[1]"/>
    
    <!-- valori -->
    <let name="categ_0093" value="normalize-space(@categ_venit)"/>
    <let name="hasCaen_0093" value="exists(@caen)"/>
    
    <!-- validare bidirectionala -->
    <let name="isValid_0093"
      value="
      ( $categ_0093 = '1016' and $hasCaen_0093 )
      or
      ( $categ_0093 != '1016' and not($hasCaen_0093) )
      "/>
    
    <assert test="$isValid_0093"
      flag="fatal"
      id="BR-D212-0093">
      [BR-D212-0093]
      Atributele
      <value-of select="
        if (normalize-space($desc_categ_0093)!='')
        then $desc_categ_0093
        else 'categ_venit'
        "/>
      (categ_venit)
      si
      <value-of select="
        if (normalize-space($desc_caen_0093)!='')
        then $desc_caen_0093
        else 'caen'
        "/>
      (caen)
      din elementul <value-of select="name(.)"/>
      trebuie corelate astfel:
      - daca categoria de venit este 1016 (Activitati independente), atunci codul CAEN trebuie sa fie completat,
      - iar daca codul CAEN este completat, atunci categoria de venit trebuie sa fie 1016(Activitati independente).
    </assert>
    <!-- =================================================================== -->
    <!-- BR-D212-0094                                                         -->
    <!-- IF categ_venit NOT IN (1003,1012,1021,1022,1023,1024, 1025,1026) THEN descriere_sediu_bun MUST EXISTS -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_venit"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_descriere_sediu_bun"
      value="$schema//xs:attribute[@name='descriere_sediu_bun']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit" value="normalize-space(string(@categ_venit))"/>
    <let name="has_descriere_sediu_bun" value="normalize-space(string(@descriere_sediu_bun)) != ''"/>
    
    <let name="isValid_0094"
      value="($v_categ_venit = ('1003','1012','1021','1022','1023','1024', '1025','1026')) or $has_descriere_sediu_bun"/>
    
    <assert id="BR-D212-0094" test="$isValid_0094">
      [BR-D212-0094]Atributul
      <value-of select="if (normalize-space(string($desc_descriere_sediu_bun)) != '') then $desc_descriere_sediu_bun else 'descriere_sediu_bun'"/>
      din elementul <value-of select="name(.)"/> trebuie să existe atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit)) != '') then $desc_categ_venit else 'categ_venit'"/>
      nu este în lista (1003, 1012, 1021, 1022, 1023, 1024, 1025, 1026).
    </assert>
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0095                                                         -->
    <!-- IF categ_venit IN (1016 OR (1015)) THEN nr_doc_autoriz MUST EXISTS -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_venit_0095"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_nr_doc_autoriz_0095"
      value="$schema//xs:attribute[@name='nr_doc_autoriz']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0095" value="normalize-space(string(@categ_venit))"/>
    <let name="has_nr_doc_autoriz_0095" value="normalize-space(string(@nr_doc_autoriz)) != ''"/>
    
    <let name="cond_necesita_nr_doc_autoriz"
      value="$v_categ_venit_0095 = ('1016','1015')"/>
    
    <let name="isValid_0095"
      value="not($cond_necesita_nr_doc_autoriz) or $has_nr_doc_autoriz_0095"/>
    
    <assert id="BR-D212-0095" test="$isValid_0095">
      [BR-D212-0095]Atributul
      <value-of select="if (normalize-space(string($desc_nr_doc_autoriz_0095)) != '') then $desc_nr_doc_autoriz_0095 else 'nr_doc_autoriz'"/>
      din elementul <value-of select="name(.)"/> trebuie să existe atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0095)) != '') then $desc_categ_venit_0095 else 'categ_venit'"/>
      este 1016 sau 1015.
    </assert>
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0096                                                         -->
    <!-- IF nr_doc_autoriz EXISTS THEN data_doc_autoriz MUST EXISTS si reciproc -->
    <!-- =================================================================== -->
    
    <let name="desc_nr_doc_autoriz_0096"
      value="$schema//xs:attribute[@name='nr_doc_autoriz']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_data_doc_autoriz_0096"
      value="$schema//xs:attribute[@name='data_doc_autoriz']/xs:annotation/xs:documentation[1]"/>
    
    <let name="has_nr_doc_autoriz_0096" value="normalize-space(string(@nr_doc_autoriz)) != ''"/>
    <let name="has_data_doc_autoriz_0096" value="normalize-space(string(@data_doc_autoriz)) != ''"/>
    
    <let name="isValid_0096"
      value="($has_nr_doc_autoriz_0096 and $has_data_doc_autoriz_0096) or (not($has_nr_doc_autoriz_0096) and not($has_data_doc_autoriz_0096))"/>
    
    <assert id="BR-D212-0096" test="$isValid_0096">
      [BR-D212-0096]Atributele
      <value-of select="if (normalize-space(string($desc_nr_doc_autoriz_0096)) != '') then $desc_nr_doc_autoriz_0096 else 'nr_doc_autoriz'"/>
      și
      <value-of select="if (normalize-space(string($desc_data_doc_autoriz_0096)) != '') then $desc_data_doc_autoriz_0096 else 'data_doc_autoriz'"/>
      din elementul <value-of select="name(.)"/> trebuie corelate astfel: dacă unul există, atunci și celălalt trebuie să existe (și reciproc).
    </assert>
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0097                                                         -->
    <!-- IF (categ_venit IN (1016,1003,1009,1010,1011) AND forma_org = 2)       -->
    <!-- THEN nr_doc_asociere MUST EXISTS                                     -->
    <!-- =================================================================== -->
    <let name="desc_categ_venit_0097"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_forma_org_0097"
      value="$schema//xs:attribute[@name='forma_org']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_nr_doc_asociere"
      value="$schema//xs:attribute[@name='nr_doc_asociere']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0097" value="normalize-space(string(@categ_venit))"/>
    <let name="v_forma_org_0097" value="normalize-space(string(@forma_org))"/>
    <let name="has_nr_doc_asociere" value="normalize-space(string(@nr_doc_asociere)) != ''"/>
    
    <let name="cond_necesita_nr_doc_asociere"
      value="($v_categ_venit_0097 = ('1016','1003','1009','1010','1011'))
      and
      ($v_forma_org_0097 = '2')"/>
    
    <let name="isValid_0097"
      value="not($cond_necesita_nr_doc_asociere) or $has_nr_doc_asociere"/>
    
    <assert id="BR-D212-0097" test="$isValid_0097">
      [BR-D212-0097]Atributul
      <value-of select="if (normalize-space(string($desc_nr_doc_asociere)) != '')
        then $desc_nr_doc_asociere
        else 'nr_doc_asociere'"/>
      din elementul <value-of select="name(.)"/>
      trebuie să existe atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0097)) != '')
        then $desc_categ_venit_0097
        else 'categ_venit'"/>
      este în lista (1016, 1003, 1009, 1010, 1011) și atributul
      <value-of select="if (normalize-space(string($desc_forma_org_0097)) != '')
        then $desc_forma_org_0097
        else 'forma_org'"/>
      este 2.
    </assert>
    
    
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0098                                                         -->
    <!-- IF nr_doc_asociere EXISTS THEN data_doc_asociere MUST EXISTS si reciproc -->
    <!-- Cerinta: regula se aplica DOAR daca exista cel putin unul din atribute -->
    <!-- =================================================================== -->
    
    <let name="nr_doc_asociere"
      value="$schema//xs:attribute[@name='nr_doc_asociere']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_data_doc_asociere"
      value="$schema//xs:attribute[@name='data_doc_asociere']/xs:annotation/xs:documentation[1]"/>
    
    <let name="has_nr_doc_asociere" value="normalize-space(string(@nr_doc_asociere)) != ''"/>
    <let name="has_data_doc_asociere" value="normalize-space(string(@data_doc_asociere)) != ''"/>
    
    <!-- validare conditionata: daca niciun atribut nu exista -> nu se valideaza -->
    <let name="isValid_0098"
      value="not($has_nr_doc_asociere or $has_data_doc_asociere)
      or
      (($has_nr_doc_asociere and $has_data_doc_asociere)
      or
      (not($has_nr_doc_asociere) and not($has_data_doc_asociere)))"/>
    
    <assert id="BR-D212-0098" test="$isValid_0098">
      [BR-D212-0098]Atributele
      <value-of select="if (normalize-space(string($desc_nr_doc_asociere)) != '')
        then $desc_nr_doc_asociere
        else 'nr_doc_asociere'"/>
      și
      <value-of select="if (normalize-space(string($desc_data_doc_asociere)) != '')
        then $desc_data_doc_asociere
        else 'data_doc_asociere'"/>
      din elementul <value-of select="name(.)"/>
      trebuie corelate astfel: dacă unul există, atunci și celălalt trebuie să existe (și reciproc).
      (regula se aplică doar dacă există cel puțin unul dintre atribute)
    </assert>
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0099                                                         -->
    <!-- IF categ_venit NOT IN (1016, 1003, 1009, 1010, 1011)→ nr_zile_scutite MUST NOT EXISTS -->
    <!-- =================================================================== -->
    <let name="desc_categ_venit_0099"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_nr_zile_scutite_0099"
      value="$schema//xs:attribute[@name='nr_zile_scutite']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0099" value="normalize-space(string(@categ_venit))"/>
    <let name="has_nr_zile_scutite_0099" value="normalize-space(string(@nr_zile_scutite)) != ''"/>
    
    <let name="isValid_0099"
      value="($v_categ_venit_0099 = ('1016','1003','1009','1010','1011'))
      or
      not($has_nr_zile_scutite_0099)"/>
    
    <assert id="BR-D212-0099" test="$isValid_0099">
      [BR-D212-0099]Atributul
      <value-of select="if (normalize-space(string($desc_nr_zile_scutite_0099)) != '')
        then $desc_nr_zile_scutite_0099
        else 'nr_zile_scutite'"/>
      din elementul <value-of select="name(.)"/>
      nu trebuie să existe atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0099)) != '')
        then $desc_categ_venit_0099
        else 'categ_venit'"/>
      nu este în lista (1016, 1003, 1009, 1010, 1011).
    </assert>
    
    <!-- =================================================================== -->
    <!-- BR-D212-0100                                                         -->
    <!-- IF an = an_r − 1 și anul NU este bisect → nr_zile_scutite ≤ 365 -->
    <!-- =================================================================== -->
    <let name="desc_an_0100"
      value="$schema//xs:attribute[@name='an']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_nr_zile_scutite_0100"
      value="$schema//xs:attribute[@name='nr_zile_scutite']/xs:annotation/xs:documentation[1]"/>
    
    <let name="has_nr_zile_scutite_0100"
      value="exists(@nr_zile_scutite) and normalize-space(string(@nr_zile_scutite)) != ''"/>
    <let name="has_an_0100" value="exists(@an) and normalize-space(string(@an)) != ''"/>
    <let name="has_an_r_0100" value="exists(/d212:declaratie/@an_r) and normalize-space(string(/d212:declaratie/@an_r)) != ''"/>
    
    <let name="v_an_0100" value="if ($has_an_0100) then number(normalize-space(string(@an))) else 0"/>
    <let name="v_an_r_0100" value="if ($has_an_r_0100) then number(normalize-space(string(/d212:declaratie/@an_r))) else 0"/>
    <let name="v_nr_zile_scutite_0100" value="if ($has_nr_zile_scutite_0100) then number(normalize-space(string(@nr_zile_scutite))) else 0"/>
    
    <let name="isLeapYear_0100"
      value="($v_an_0100 mod 4 = 0 and $v_an_0100 mod 100 != 0) or ($v_an_0100 mod 400 = 0)"/>
    <let name="isRegularYear" value="not($isLeapYear_0100)"/>
    
    <let name="cond_aplicare_0100"
      value="$has_nr_zile_scutite_0100 and $has_an_0100 and $has_an_r_0100 and ($v_an_0100 = $v_an_r_0100 - 1) and $isRegularYear"/>
    
    <let name="isValid_0100"
      value="not($cond_aplicare_0100) or ($v_nr_zile_scutite_0100 &lt;= 365)"/>
    
    <assert id="BR-D212-0100" test="$isValid_0100">
      [BR-D212-0100] Atributul
      <value-of select="if (normalize-space(string($desc_nr_zile_scutite_0100)) != '') then $desc_nr_zile_scutite_0100 else 'nr_zile_scutite'"/>
      din elementul <value-of select="name(.)"/>
      trebuie să fie mai mic sau egal cu 365 atunci când atributul
      <value-of select="if (normalize-space(string($desc_an_0100)) != '') then $desc_an_0100 else 'an'"/>
      este egal cu anul de raportare minus 1 și anul nu este bisect.
      (regula se aplică doar dacă nr_zile_scutite, an și an_r există)
    </assert>
    
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0101                                                        -->
    <!-- IF an = an_r − 1 și anul ESTE bisect → nr_zile_scutite ≤ 366 -->
    <!-- =================================================================== -->
    <let name="desc_an_01001"
      value="$schema//xs:attribute[@name='an']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_nr_zile_scutite_01001"
      value="$schema//xs:attribute[@name='nr_zile_scutite']/xs:annotation/xs:documentation[1]"/>
    
    <let name="has_nr_zile_scutite_01001"
      value="exists(@nr_zile_scutite) and normalize-space(string(@nr_zile_scutite)) != ''"/>
    <let name="has_an_01001" value="exists(@an) and normalize-space(string(@an)) != ''"/>
    <let name="has_an_r_01001" value="exists(/d212:declaratie/@an_r) and normalize-space(string(/d212:declaratie/@an_r)) != ''"/>
    
    <let name="v_an_01001" value="if ($has_an_01001) then number(normalize-space(string(@an))) else 0"/>
    <let name="v_an_r_01001" value="if ($has_an_r_01001) then number(normalize-space(string(/d212:declaratie/@an_r))) else 0"/>
    <let name="v_nr_zile_scutite_01001" value="if ($has_nr_zile_scutite_01001) then number(normalize-space(string(@nr_zile_scutite))) else 0"/>
    
    <let name="isLeapYear_01001"
      value="($v_an_01001 mod 4 = 0 and $v_an_01001 mod 100 != 0) or ($v_an_01001 mod 400 = 0)"/>
    
    <let name="cond_aplicare_01001"
      value="$has_nr_zile_scutite_01001 and $has_an_01001 and $has_an_r_01001 and ($v_an_01001 = $v_an_r_01001 - 1) and $isLeapYear_01001"/>
    
    <let name="isValid_0101"
      value="not($cond_aplicare_01001) or ($v_nr_zile_scutite_01001 &lt;= 366)"/>
    
    <assert id="BR-D212-0101" test="$isValid_0101">
      [BR-D212-0101] Atributul
      <value-of select="if (normalize-space(string($desc_nr_zile_scutite_01001)) != '') then $desc_nr_zile_scutite_01001 else 'nr_zile_scutite'"/>
      din elementul <value-of select="name(.)"/>
      trebuie să fie mai mic sau egal cu 366 atunci când atributul
      <value-of select="if (normalize-space(string($desc_an_01001)) != '') then $desc_an_01001 else 'an'"/>
      este egal cu anul de raportare minus 1 și anul este bisect.
      (regula se aplică doar dacă nr_zile_scutite, an și an_r există)
    </assert>
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0102                                                         -->
    <!-- IF ((categ_venit IN (1016,1003,1009,1010,1011) AND forma_org=1) OR categ_venit IN (1015,1006,1026)) -->
    <!--      THEN venit_brut MUST EXISTS ELSE venit_brut MUST NOT EXISTS      -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_venit_0102"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_forma_org_0102"
      value="$schema//xs:attribute[@name='forma_org']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_brut_0102"
      value="$schema//xs:attribute[@name='venit_brut']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0102" value="normalize-space(string(@categ_venit))"/>
    <let name="v_forma_org_0102" value="normalize-space(string(@forma_org))"/>
    <let name="has_venit_brut_0102" value="normalize-space(string(@venit_brut)) != ''"/>
    
    <let name="cond_necesita_venit_brut_0102"
      value="(($v_categ_venit_0102 = ('1016','1003','1009','1010','1011')) and ($v_forma_org_0102 = '1'))
      or
      ($v_categ_venit_0102 = ('1015','1006','1026'))"/>
    
    <let name="isValid_0102"
      value="($cond_necesita_venit_brut_0102 and $has_venit_brut_0102)
      or
      (not($cond_necesita_venit_brut_0102) and not($has_venit_brut_0102))"/>
    
    <assert id="BR-D212-0102" test="$isValid_0102">
      [BR-D212-0102]Atributul
      <value-of select="if (normalize-space(string($desc_venit_brut_0102)) != '')
        then $desc_venit_brut_0102
        else 'venit_brut'"/>
      din elementul <value-of select="name(.)"/>
      trebuie să existe atunci când:
      (atributul <value-of select="if (normalize-space(string($desc_categ_venit_0102)) != '')
        then $desc_categ_venit_0102
        else 'categ_venit'"/>
      este în lista (1016, 1003, 1009, 1010, 1011) și atributul
      <value-of select="if (normalize-space(string($desc_forma_org_0102)) != '')
        then $desc_forma_org_0102
        else 'forma_org'"/>
      este 1)
      sau când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0102)) != '')
        then $desc_categ_venit_0102
        else 'categ_venit'"/>
      este în lista (1015,1006,1026);
      în caz contrar, atributul nu trebuie să existe.
    </assert>
    
    <!-- =================================================================== -->
    <!-- BR-D212-0103                                                         -->
    <!-- IF ((categ_venit IN (1016,1003,1009,1010,1011) AND forma_org IN (2, 3)) OR categ_venit IN (1012)) -->
    <!-- THEN (venit_net_anual OR pierdere) MUST EXISTS                       -->
    <!-- =================================================================== -->
    <let name="desc_categ_venit_0103"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_forma_org_0103"
      value="$schema//xs:attribute[@name='forma_org']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_net_anual_0103"
      value="$schema//xs:attribute[@name='venit_net_anual']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_pierdere_0103"
      value="$schema//xs:attribute[@name='pierdere']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0103" value="normalize-space(string(@categ_venit))"/>
    <let name="v_forma_org_0103" value="normalize-space(string(@forma_org))"/>
    
    <let name="has_venit_net_anual_0103" value="normalize-space(string(@venit_net_anual)) != ''"/>
    <let name="has_pierdere_0103" value="normalize-space(string(@pierdere)) != ''"/>
    
    <let name="cond_necesita_venitnet_sau_pierdere_0103"
      value="
      (
      ($v_categ_venit_0103 = ('1016','1003','1009','1010','1011')
      and $v_forma_org_0103 = ('2','3'))
      or
      ($v_categ_venit_0103 = ('1015','1006')
      and $v_forma_org_0103 = '3')
      or
      ($v_categ_venit_0103 = '1012')
      )
      "/>
    
    
    <!-- XOR: exact unul trebuie sa existe -->
    <let name="isValid_0103"
      value="not($cond_necesita_venitnet_sau_pierdere_0103)
      or
      (($has_venit_net_anual_0103 and not($has_pierdere_0103))
      or
      ($has_pierdere_0103 and not($has_venit_net_anual_0103)))"/>
    
    <assert id="BR-D212-0103" test="$isValid_0103">
      [BR-D212-0103] Atributele
      <value-of select="if (normalize-space(string($desc_venit_net_anual_0103)) != '')
        then $desc_venit_net_anual_0103
        else 'venit_net_anual'"/>
      și
      <value-of select="if (normalize-space(string($desc_pierdere_0103)) != '')
        then $desc_pierdere_0103
        else 'pierdere'"/>
      din elementul <value-of select="name(.)"/>
      trebuie corelate astfel:
      atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0103)) != '')
        then $desc_categ_venit_0103
        else 'categ_venit'"/>
      este în lista (1012),
      sau atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0103)) != '')
        then $desc_categ_venit_0103
        else 'categ_venit'"/>
      este în lista (1016, 1003, 1009, 1010, 1011)
      și atributul
      <value-of select="if (normalize-space(string($desc_forma_org_0103)) != '')
        then $desc_forma_org_0103
        else 'forma_org'"/>
      este 2,
      trebuie să existe exact unul dintre atributele venit_net_anual și pierdere.
      În toate celelalte situații, atributele venit_net_anual și pierdere nu trebuie să existe.
    </assert>
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0104                                                         -->
    <!-- IF pierdere > 0 THEN venit_net_anual = (null OR 0)                    -->
    <!-- IF venit_net_anual > 0 THEN pierdere = (null OR 0)                   -->
    <!-- Cerinta: regula se aplica DOAR daca atributele exista                 -->
    <!-- (daca lipsesc ambele -> nu valideaza)                                 -->
    <!-- =================================================================== -->
      <let name="desc_venit_net_anual"
        value="$schema//xs:attribute[@name='venit_net_anual']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_pierdere"
        value="$schema//xs:attribute[@name='pierdere']/xs:annotation/xs:documentation[1]"/>
      
      <!-- existenta atributelor (declanseaza / nu declanseaza validarea) -->
      <let name="has_venit_net_anual"
        value="exists(@venit_net_anual) and normalize-space(string(@venit_net_anual)) != ''"/>
      <let name="has_pierdere"
        value="exists(@pierdere) and normalize-space(string(@pierdere)) != ''"/>
      
      <!-- valori numerice (lipsa/vid nu se foloseste in calcul; cand exista, se citeste numeric) -->
      <let name="venit_net_anual_val"
        value="if ($has_venit_net_anual)
        then number(normalize-space(string(@venit_net_anual)))
        else 0"/>
      
      <let name="pierdere_val"
        value="if ($has_pierdere)
        then number(normalize-space(string(@pierdere)))
        else 0"/>
      
      <!-- validare: se aplica doar daca exista cel putin unul din atribute -->
      <let name="isValid_0104"
        value="not($has_venit_net_anual or $has_pierdere)
        or
        not(($pierdere_val &gt; 0 and $venit_net_anual_val &gt; 0)
        or
        ($venit_net_anual_val &gt; 0 and $pierdere_val &gt; 0))"/>
      
      <assert id="BR-D212-0104" test="$isValid_0104">
        [BR-D212-0104]Atributele
        <value-of select="if (normalize-space(string($desc_venit_net_anual)) != '')
          then $desc_venit_net_anual
          else 'venit_net_anual'"/>
        și
        <value-of select="if (normalize-space(string($desc_pierdere)) != '')
          then $desc_pierdere
          else 'pierdere'"/>
        din elementul <value-of select="name(.)"/>
        trebuie corelate astfel: dacă unul dintre ele are o valoare mai mare decât 0,
        atunci celălalt trebuie să fie nul sau egal cu 0 (nu pot fi ambele pozitive).
        (regula se aplică doar dacă există cel puțin unul dintre atribute)
      </assert>
    <!-- =================================================================== -->
    <!-- BR-D212-0106                                                         -->
    <!-- IF categ_venit IN (1025,1021,1022,1023,1024) THEN venit_recalculat MUST EXISTS -->
    <!-- =================================================================== -->
    <let name="desc_categ_venit_0106"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_recalculat_0106"
      value="$schema//xs:attribute[@name='venit_recalculat']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0106" value="normalize-space(string(@categ_venit))"/>
    <let name="has_venit_recalculat_0106"
      value="exists(@venit_recalculat) and normalize-space(string(@venit_recalculat)) != ''"/>
    
    <let name="cond_necesita_venit_recalculat_0106"
      value="$v_categ_venit_0106 = ('1025','1021','1022','1023','1024')"/>
    
    <let name="isValid_0106"
      value="not($cond_necesita_venit_recalculat_0106) or $has_venit_recalculat_0106"/>
    
    <assert id="BR-D212-0106" test="$isValid_0106">
      [BR-D212-0106] Atributul
      <value-of select="if (normalize-space(string($desc_venit_recalculat_0106)) != '')
        then $desc_venit_recalculat_0106
        else 'venit_recalculat'"/>
      din elementul <value-of select="name(.)"/>
      trebuie să existe atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0106)) != '')
        then $desc_categ_venit_0106
        else 'categ_venit'"/>
      este în lista (1025, 1021, 1022, 1023, 1024).
    </assert>
    <!-- =================================================================== -->
    <!-- BR-D212-0107                                                         -->
    <!-- IF categ_venit NOT IN (1025,1021,1022,1023,1024) THEN                 -->
    <!-- venit_recalculat MUST EXISTS AND venit_recalculat = venit_net_anual - pierdere_compensata -->
    <!-- In calcul: venit_net_anual / pierdere_compensata lipsa => 0           -->
    <!-- =================================================================== -->
    <let name="desc_categ_venit_0107"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_recalculat_0107"
      value="$schema//xs:attribute[@name='venit_recalculat']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_net_anual_0107"
      value="$schema//xs:attribute[@name='venit_net_anual']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_pierdere_compensata_0107"
      value="$schema//xs:attribute[@name='pierdere_compensata']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0107" value="normalize-space(string(@categ_venit))"/>
    
    <let name="has_venit_recalculat_0107"
      value="exists(@venit_recalculat) and normalize-space(string(@venit_recalculat)) != ''"/>
    
    <let name="venit_recalculat_val_0107"
      value="if ($has_venit_recalculat_0107)
      then number(normalize-space(string(@venit_recalculat)))
      else 0"/>
    
    <let name="venit_net_anual_val_0107"
      value="if (exists(@venit_net_anual) and normalize-space(string(@venit_net_anual)) != '')
      then number(normalize-space(string(@venit_net_anual)))
      else 0"/>
    
    <let name="pierdere_compensata_val_0107"
      value="if (exists(@pierdere_compensata) and normalize-space(string(@pierdere_compensata)) != '')
      then number(normalize-space(string(@pierdere_compensata)))
      else 0"/>
    
    <let name="cond_formula_0107"
      value="not($v_categ_venit_0107 = ('1025','1021','1022','1023','1024'))"/>
    
    <let name="formula_val_0107"
      value="$venit_net_anual_val_0107 - $pierdere_compensata_val_0107"/>
    
    <let name="isValid_0107"
      value="not($cond_formula_0107)
      or
      ($has_venit_recalculat_0107 and ($venit_recalculat_val_0107 = $formula_val_0107))"/>
    
    <assert id="BR-D212-0107" test="$isValid_0107">
      [BR-D212-0107] Atributul
      <value-of select="if (normalize-space(string($desc_venit_recalculat_0107)) != '')
        then $desc_venit_recalculat_0107
        else 'venit_recalculat'"/>
      din elementul <value-of select="name(.)"/>
      trebuie să existe și trebuie să fie egal cu:
      <value-of select="if (normalize-space(string($desc_venit_net_anual_0107)) != '')
        then $desc_venit_net_anual_0107
        else 'venit_net_anual'"/>
      minus
      <value-of select="if (normalize-space(string($desc_pierdere_compensata_0107)) != '')
        then $desc_pierdere_compensata_0107
        else 'pierdere_compensata'"/>
      atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0107)) != '')
        then $desc_categ_venit_0107
        else 'categ_venit'"/>
      nu este în lista (1025, 1021, 1022, 1023, 1024).
      (în calcul, atributele lipsă se consideră 0)
    </assert>
    <!-- =================================================================== -->
    <!-- BR-D212-0108                                                         -->
    <!-- IF categ_venit IN (1021,1022,1023,1024,1025) THEN                     -->
    <!-- venit_brut, chelt_deduc, venit_net_anual, pierdere, pierdere_precedenta, -->
    <!-- pierdere_compensata, venit_redus MUST NOT EXISTS                      -->
    <!-- =================================================================== -->
    <let name="desc_categ_venit_0108"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    
    <let name="desc_venit_brut_0108"
      value="$schema//xs:attribute[@name='venit_brut']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_chelt_deduc_0108"
      value="$schema//xs:attribute[@name='chelt_deduc']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_net_anual_0108"
      value="$schema//xs:attribute[@name='venit_net_anual']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_pierdere_0108"
      value="$schema//xs:attribute[@name='pierdere']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_pierdere_precedenta_0108"
      value="$schema//xs:attribute[@name='pierdere_precedenta']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_pierdere_compensata_0108"
      value="$schema//xs:attribute[@name='pierdere_compensata']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_redus_0108"
      value="$schema//xs:attribute[@name='venit_redus']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0108" value="normalize-space(string(@categ_venit))"/>
    
    <let name="has_venit_brut_0108" value="exists(@venit_brut) and normalize-space(string(@venit_brut)) != ''"/>
    <let name="has_chelt_deduc_0108" value="exists(@chelt_deduc) and normalize-space(string(@chelt_deduc)) != ''"/>
    <let name="has_venit_net_anual_0108" value="exists(@venit_net_anual) and normalize-space(string(@venit_net_anual)) != ''"/>
    <let name="has_pierdere_0108" value="exists(@pierdere) and normalize-space(string(@pierdere)) != ''"/>
    <let name="has_pierdere_precedenta_0108" value="exists(@pierdere_precedenta) and normalize-space(string(@pierdere_precedenta)) != ''"/>
    <let name="has_pierdere_compensata_0108" value="exists(@pierdere_compensata) and normalize-space(string(@pierdere_compensata)) != ''"/>
    <let name="has_venit_redus_0108" value="exists(@venit_redus) and normalize-space(string(@venit_redus)) != ''"/>
    
    <let name="cond_interzice_set_0108"
      value="$v_categ_venit_0108 = ('1021','1022','1023','1024','1025')"/>
    
    <let name="isValid_0108"
      value="not($cond_interzice_set_0108)
      or
      not($has_venit_brut_0108
      or $has_chelt_deduc_0108
      or $has_venit_net_anual_0108
      or $has_pierdere_0108
      or $has_pierdere_precedenta_0108
      or $has_pierdere_compensata_0108
      or $has_venit_redus_0108)"/>
    
    <assert id="BR-D212-0108" test="$isValid_0108">
      [BR-D212-0108] Atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0108)) != '')
        then $desc_categ_venit_0108
        else 'categ_venit'"/>
      este în lista (1021, 1022, 1023, 1024, 1025),
      următoarele atribute din elementul <value-of select="name(.)"/> nu trebuie să existe:
      <value-of select="
        string-join((
        if ($has_venit_brut_0108) then
        (if (normalize-space(string($desc_venit_brut_0108)) != '') then $desc_venit_brut_0108 else 'venit_brut')
        else (),
        if ($has_chelt_deduc_0108) then
        (if (normalize-space(string($desc_chelt_deduc_0108)) != '') then $desc_chelt_deduc_0108 else 'chelt_deduc')
        else (),
        if ($has_venit_net_anual_0108) then
        (if (normalize-space(string($desc_venit_net_anual_0108)) != '') then $desc_venit_net_anual_0108 else 'venit_net_anual')
        else (),
        if ($has_pierdere_0108) then
        (if (normalize-space(string($desc_pierdere_0108)) != '') then $desc_pierdere_0108 else 'pierdere')
        else (),
        if ($has_pierdere_precedenta_0108) then
        (if (normalize-space(string($desc_pierdere_precedenta_0108)) != '') then $desc_pierdere_precedenta_0108 else 'pierdere_precedenta')
        else (),
        if ($has_pierdere_compensata_0108) then
        (if (normalize-space(string($desc_pierdere_compensata_0108)) != '') then $desc_pierdere_compensata_0108 else 'pierdere_compensata')
        else (),
        if ($has_venit_redus_0108) then
        (if (normalize-space(string($desc_venit_redus_0108)) != '') then $desc_venit_redus_0108 else 'venit_redus')
        else ()
        ), ', ')
        "/>.
    </assert>
    <!-- =================================================================== -->
    <!-- BR-D212-0109                                                         -->
    <!-- IF ( (categ_venit=1003 AND det_ven_net=2) OR categ_venit IN (1009,1010,1011) ) -->
    <!--    AND nr_zile_scutite EXISTS                                        -->
    <!-- THEN venit_redus MUST EXISTS                                         -->
    <!-- ELSE venit_redus MUST NOT EXISTS                                     -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_venit_0109"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_det_ven_net_0109"
      value="$schema//xs:attribute[@name='det_ven_net']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_nr_zile_scutite_0109"
      value="$schema//xs:attribute[@name='nr_zile_scutite']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_redus_0109"
      value="$schema//xs:attribute[@name='venit_redus']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0109" value="normalize-space(string(@categ_venit))"/>
    <let name="v_det_ven_net_0109" value="normalize-space(string(@det_ven_net))"/>
    
    <let name="has_nr_zile_scutite_0109"
      value="exists(@nr_zile_scutite) and normalize-space(string(@nr_zile_scutite)) != ''"/>
    <let name="has_venit_redus_0109"
      value="exists(@venit_redus) and normalize-space(string(@venit_redus)) != ''"/>
    
    <let name="cond_permisiune_venit_redus_0109"
      value="((($v_categ_venit_0109 = '1003') and ($v_det_ven_net_0109 = '2'))
      or
      ($v_categ_venit_0109 = ('1009','1010','1011')))
      and
      $has_nr_zile_scutite_0109"/>
    
    <let name="isValid_0109"
      value="($cond_permisiune_venit_redus_0109 and $has_venit_redus_0109)
      or
      (not($cond_permisiune_venit_redus_0109) and not($has_venit_redus_0109))"/>
    
    <assert id="BR-D212-0109" test="$isValid_0109">
      [BR-D212-0109] Atributul
      <value-of select="if (normalize-space(string($desc_venit_redus_0109)) != '')
        then $desc_venit_redus_0109
        else 'venit_redus'"/>
      din elementul <value-of select="name(.)"/>
      trebuie corelat astfel:
      dacă (categ_venit = 1003 și det_ven_net = 2) sau categ_venit este în lista (1009, 1010, 1011)
      și atributul
      <value-of select="if (normalize-space(string($desc_nr_zile_scutite_0109)) != '')
        then $desc_nr_zile_scutite_0109
        else 'nr_zile_scutite'"/>
      există, atunci venit_redus trebuie să existe; în toate celelalte situații, venit_redus nu trebuie să existe.
    </assert>
    <!-- =================================================================== -->
    <!-- BR-D212-0110                                                         -->
    <!-- IF (categ_venit IN (1016,1003) AND det_ven_net = 1) THEN impozit11 MUST NOT EXISTS -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_venit_0110"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_det_ven_net_0110"
      value="$schema//xs:attribute[@name='det_ven_net']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_impozit11_0110"
      value="$schema//xs:attribute[@name='impozit11']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0110" value="normalize-space(string(@categ_venit))"/>
    <let name="v_det_ven_net_0110" value="normalize-space(string(@det_ven_net))"/>
    
    <let name="has_impozit11_0110"
      value="exists(@impozit11) and normalize-space(string(@impozit11)) != ''"/>
    
    <let name="cond_interzice_impozit11_0110"
      value="($v_categ_venit_0110 = ('1016','1003')) and ($v_det_ven_net_0110 = '1')"/>
    
    <let name="isValid_0110"
      value="not($cond_interzice_impozit11_0110) or not($has_impozit11_0110)"/>
    
    <assert id="BR-D212-0110" test="$isValid_0110">
      [BR-D212-0110] Atributul
      <value-of select="if (normalize-space(string($desc_impozit11_0110)) != '')
        then $desc_impozit11_0110
        else 'impozit11'"/>
      din elementul <value-of select="name(.)"/>
      nu trebuie să existe atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0110)) != '')
        then $desc_categ_venit_0110
        else 'categ_venit'"/>
      este în lista (1016, 1003) și atributul
      <value-of select="if (normalize-space(string($desc_det_ven_net_0110)) != '')
        then $desc_det_ven_net_0110
        else 'det_ven_net'"/>
      este 1.
    </assert>
    <!-- =================================================================== -->
    <!-- BR-D212-0111                                                         -->
    <!-- IF (categ_venit IN (1016,1003) AND det_ven_net = 1) THEN venit_redus MUST NOT EXISTS -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_venit_0111"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_det_ven_net_0111"
      value="$schema//xs:attribute[@name='det_ven_net']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_venit_redus_0111"
      value="$schema//xs:attribute[@name='venit_redus']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0111" value="normalize-space(string(@categ_venit))"/>
    <let name="v_det_ven_net_0111" value="normalize-space(string(@det_ven_net))"/>
    
    <let name="has_venit_redus_0111"
      value="exists(@venit_redus) and normalize-space(string(@venit_redus)) != ''"/>
    
    <let name="cond_interzice_venit_redus_0111"
      value="($v_categ_venit_0111 = ('1016','1003')) and ($v_det_ven_net_0111 = '1')"/>
    
    <let name="isValid_0111"
      value="not($cond_interzice_venit_redus_0111) or not($has_venit_redus_0111)"/>
    
    <assert id="BR-D212-0111" test="$isValid_0111">
      [BR-D212-0111] Atributul
      <value-of select="if (normalize-space(string($desc_venit_redus_0111)) != '')
        then $desc_venit_redus_0111
        else 'venit_redus'"/>
      din elementul <value-of select="name(.)"/>
      nu trebuie să existe atunci când atributul
      <value-of select="if (normalize-space(string($desc_categ_venit_0111)) != '')
        then $desc_categ_venit_0111
        else 'categ_venit'"/>
      este în lista (1016, 1003) și atributul
      <value-of select="if (normalize-space(string($desc_det_ven_net_0111)) != '')
        then $desc_det_ven_net_0111
        else 'det_ven_net'"/>
      este 1.
    </assert>
    <!-- ===================================================================== -->
    <!-- BR-D212-0112:
     IF ( NOT( categ_venit IN (1016,1003) AND det_ven_net = 1 ) )
        THEN ( IF pierdere EXISTS THEN impozit11 MUST EXISTS AND impozit11 = 0 )
-->
    <!-- Context recomandat: d212:cap11 -->
    <!-- ===================================================================== -->
      
      <!-- descrieri din XSD -->
      <let name="desc_categ_0112"
        value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_det_0112"
        value="$schema//xs:attribute[@name='det_ven_net']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_pierdere_0112"
        value="$schema//xs:attribute[@name='pierdere']/xs:annotation/xs:documentation[1]"/>
      <let name="desc_impozit_0112"
        value="$schema//xs:attribute[@name='impozit11']/xs:annotation/xs:documentation[1]"/>
      
      <!-- valori normalizate -->
      <let name="v_categ_0112" value="normalize-space(string(@categ_venit))"/>
      <let name="v_det_0112"   value="normalize-space(string(@det_ven_net))"/>
      
      <!-- exceptie: (categ_venit IN (1016,1003) AND det_ven_net=1) -->
      <let name="isExcept_0112"
        value="($v_categ_0112 = '1016' or $v_categ_0112 = '1003')
        and $v_det_0112 = '1'"/>
      
      <!-- pierdere exista si este completata -->
      <let name="hasPierdere_0112"
        value="exists(@pierdere) and normalize-space(string(@pierdere)) != ''"/>
      
      <!-- impozit11 exista si este completat -->
      <let name="hasImpozit_0112"
        value="exists(@impozit11) and normalize-space(string(@impozit11)) != ''"/>
      
      <!-- numeric checks -->
      <let name="nImpozit_0112" value="if ($hasImpozit_0112) then number(normalize-space(string(@impozit11))) else 0"/>
      <let name="impozit_is_numeric_0112" value="not($nImpozit_0112 != $nImpozit_0112)"/>
      
      <!-- validare:
       - daca suntem in exceptie => nu aplicam regula pierdere->impozit
       - altfel, daca pierdere exista => impozit11 trebuie sa existe si sa fie 0
  -->
      <let name="isValid_0112"
        value="$isExcept_0112
        or not($hasPierdere_0112)
        or ($hasImpozit_0112 and $impozit_is_numeric_0112 and $nImpozit_0112 = 0)"/>
      
      <assert test="$isValid_0112" flag="fatal" id="BR-D212-0112">
        [BR-D212-0112]
        Daca NU sunteti in situatia
        (<value-of select="if (normalize-space($desc_categ_0112)!='') then $desc_categ_0112 else 'categ_venit'"/>(categ_venit) in (1016,1003)
        si
        <value-of select="if (normalize-space($desc_det_0112)!='') then $desc_det_0112 else 'det_ven_net'"/>(det_ven_net)=1),
        atunci, cand atributul
        <value-of select="if (normalize-space($desc_pierdere_0112)!='') then $desc_pierdere_0112 else 'pierdere'"/>(pierdere)
        este completat, atributul
        <value-of select="if (normalize-space($desc_impozit_0112)!='') then $desc_impozit_0112 else 'impozit11'"/>(impozit11)
        trebuie sa existe si sa aiba valoarea 0.
      </assert>
      
    
    
    <!-- =================================================================== -->
    <!-- BR-D212-0113                                                         -->
    <!-- impozit_retinut este permis doar in cazurile:                          -->
    <!-- (categ_venit = 1016) OR (categ_venit = 1021) OR (categ_venit = 1003 AND reg = 1) -->
    <!-- In toate celelalte situatii, impozit_retinut MUST NOT EXISTS          -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_venit_0113"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_reg_0113"
      value="$schema//xs:attribute[@name='reg']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_impozit_retinut_0113"
      value="$schema//xs:attribute[@name='impozit_retinut']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0113" value="normalize-space(string(@categ_venit))"/>
    <let name="v_reg_0113" value="normalize-space(string(@reg))"/>
    
    <let name="has_impozit_retinut_0113"
      value="exists(@impozit_retinut) and normalize-space(string(@impozit_retinut)) != ''"/>
    
    <let name="cond_permisiune_impozit_retinut_0113"
      value="($v_categ_venit_0113 = '1016')
      or
      ($v_categ_venit_0113 = '1021')
      or
      (($v_categ_venit_0113 = '1003') and ($v_reg_0113 = '1'))"/>
    
    <let name="isValid_0113"
      value="$cond_permisiune_impozit_retinut_0113
      or
      not($has_impozit_retinut_0113)"/>
    
    <assert id="BR-D212-0113" test="$isValid_0113">
      [BR-D212-0113] Atributul
      <value-of select="if (normalize-space(string($desc_impozit_retinut_0113)) != '')
        then $desc_impozit_retinut_0113
        else 'impozit_retinut'"/>
      din elementul <value-of select="name(.)"/>
      nu trebuie să existe în afara situațiilor în care:
      categ_venit este 1016 sau 1021,
      sau categ_venit este 1003 și reg este 1.
    </assert>
    <!-- =================================================================== -->
    <!-- BR-D212-0114                                                         -->
    <!-- IF categ_venit = 1015 THEN tip_chirie MUST EXISTS si reciproc         -->
    <!-- (tip_chirie exista daca si numai daca categ_venit = 1015)            -->
    <!-- =================================================================== -->
    
    <let name="desc_categ_venit_0114"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    <let name="desc_tip_chirie_0114"
      value="$schema//xs:attribute[@name='tip_chirie']/xs:annotation/xs:documentation[1]"/>
    
    <let name="v_categ_venit_0114" value="normalize-space(string(@categ_venit))"/>
    
    <let name="has_tip_chirie_0114"
      value="exists(@tip_chirie) and normalize-space(string(@tip_chirie)) != ''"/>
    
    <let name="cond_categ_1015_0114"
      value="$v_categ_venit_0114 = '1015'"/>
    
    <let name="isValid_0114"
      value="($cond_categ_1015_0114 and $has_tip_chirie_0114)
      or
      (not($cond_categ_1015_0114) and not($has_tip_chirie_0114))"/>
    
    <assert id="BR-D212-0114" test="$isValid_0114">
      [BR-D212-0114] Atributul
      <value-of select="if (normalize-space(string($desc_tip_chirie_0114)) != '')
        then $desc_tip_chirie_0114
        else 'tip_chirie'"/>
      din elementul <value-of select="name(.)"/>
      trebuie corelat astfel: dacă categ_venit este 1015, atunci tip_chirie trebuie să existe;
      în toate celelalte situații, tip_chirie nu trebuie să existe.
    </assert>
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
  </rule>
  <!-- ===================================================== -->
  <!-- BR-D212-0085: daca categ_venit = 1012 => aparitie unica in toata declaratia -->
  <!-- ===================================================== -->
  <rule context="d212:cap11[@categ_venit = '1012']">
    
    <!-- descriere atribut categ_venit -->
    <let name="desc_categ_0085"
      value="$schema//xs:attribute[@name='categ_venit']/xs:annotation/xs:documentation[1]"/>
    
    <!-- valoare curenta -->
    <let name="categ_0085" value="normalize-space(@categ_venit)"/>
    
    <!-- numar aparitii cap11 cu categ_venit=1012 in tot documentul -->
    <let name="cnt_0085" value="count(//d212:cap11[normalize-space(@categ_venit) = '1012'])"/>
    
    <assert test="$cnt_0085 = 1" flag="fatal" id="BR-D212-0085">
      [BR-D212-0085]
      Atributul
      <value-of select="if (normalize-space($desc_categ_0085)!='') then $desc_categ_0085 else 'categ_venit'"/>
      (categ_venit)
      din elementul <value-of select="name(..)"/>
      trebuie sa aiba aparitie unica in declaratie atunci cand are valoarea <value-of select="$categ_0085"/>.
      In document exista <value-of select="$cnt_0085"/> aparitii cu categ_venit=1012.
    </assert>
    
  </rule>
  
</pattern>
